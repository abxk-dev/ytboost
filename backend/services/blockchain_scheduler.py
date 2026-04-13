"""
Blockchain Scheduler Service
Background job that polls BSC every 30 seconds for pending payments
"""
import asyncio
from datetime import datetime, timezone, timedelta
import os
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from backend.services.bep20_monitor import check_bep20_payment
from backend.services.webhook_processor import credit_payment

scheduler = None
db_instance = None
socket_manager_instance = None

async def check_pending_sessions():
    """Check all pending BEP20 payment sessions"""
    global db_instance, socket_manager_instance
    
    if db_instance is None:
        print("Database not initialized for scheduler")
        return
    
    try:
        # Get all pending/detecting sessions that are not expired
        grace_raw = os.environ.get("PAYMENT_SESSION_GRACE_MINUTES", "360")
        try:
            grace_minutes = int(float(grace_raw))
        except Exception:
            grace_minutes = 360
        grace_minutes = max(0, min(7 * 24 * 60, grace_minutes))

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=grace_minutes)
        sessions = await db_instance.crypto_payment_sessions.find({
            'status': {'$in': ['pending', 'detecting']},
            'expiresAt': {'$gt': cutoff},
            'network': 'BEP20'
        }).to_list(200)
        
        if not sessions:
            return
        
        print(f"🔍 Checking {len(sessions)} pending BEP20 sessions...")
        
        # Check each session (process in chunks of 5)
        for i in range(0, len(sessions), 5):
            chunk = sessions[i:i+5]
            tasks = [
                check_bep20_payment(session, db_instance, socket_manager_instance)
                for session in chunk
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Credit confirmed payments
            for j, result in enumerate(results):
                if isinstance(result, dict) and result.get('confirmations', 0) >= chunk[j].get('requiredConfirms', 1):
                    session = chunk[j]
                    if session.get('status') != 'credited':
                        await credit_payment(
                            str(session['_id']),
                            result['amount'],
                            result['txHash'],
                            db_instance,
                            socket_manager_instance
                        )
                        
    except Exception as e:
        print(f"Scheduler check error: {str(e)}")

async def expire_old_sessions():
    """Expire sessions that have timed out"""
    global db_instance
    
    if db_instance is None:
        return
    
    try:
        grace_raw = os.environ.get("PAYMENT_SESSION_GRACE_MINUTES", "360")
        try:
            grace_minutes = int(float(grace_raw))
        except Exception:
            grace_minutes = 360
        grace_minutes = max(0, min(7 * 24 * 60, grace_minutes))

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=grace_minutes)
        result = await db_instance.crypto_payment_sessions.update_many(
            {
                'status': {'$in': ['pending', 'detecting']},
                'expiresAt': {'$lt': cutoff}
            },
            {'$set': {'status': 'expired'}}
        )
        
        if result.modified_count > 0:
            print(f"Expired {result.modified_count} payment sessions")
            
    except Exception as e:
        print(f"Expire sessions error: {str(e)}")

STATUS_MAP = {
    'Pending': 'Pending',
    'In progress': 'In Progress',
    'Processing': 'Processing',
    'Completed': 'Completed',
    'Partial': 'Partial',
    'Canceled': 'Failed',
    'Cancelled': 'Failed',
    'Canceled (refunded)': 'Failed',
}

async def check_provider_orders():
    """Check status of auto-fulfilled orders from external providers every 5 min"""
    global db_instance

    if db_instance is None:
        return

    try:
        import httpx

        orders = await db_instance.orders.find({
            'fulfillmentType': 'auto',
            'providerOrderId': {'$ne': '', '$exists': True},
            'status': {'$in': ['Pending', 'Processing', 'In Progress']},
        }).to_list(200)

        if not orders:
            return

        # Group orders by provider for efficiency
        provider_cache = {}
        for order in orders:
            service = await db_instance.services.find_one({'_id': order['serviceId']})
            if not service or not service.get('providerId'):
                continue
            pid = service['providerId']
            if pid not in provider_cache:
                provider = await db_instance.api_providers.find_one({'_id': pid})
                if provider and provider.get('status', True):
                    provider_cache[pid] = provider

            provider = provider_cache.get(pid)
            if not provider:
                continue

            try:
                async with httpx.AsyncClient(timeout=10) as client:
                    resp = await client.post(provider['apiUrl'], data={
                        'key': provider['apiKey'],
                        'action': 'status',
                        'order': order['providerOrderId'],
                    })
                    result = resp.json()

                new_status = STATUS_MAP.get(result.get('status', ''))
                if not new_status or new_status == order['status']:
                    continue

                update = {'status': new_status}
                if 'start_count' in result:
                    update['startCount'] = int(result['start_count'])
                if 'remains' in result:
                    update['remains'] = int(result['remains'])

                await db_instance.orders.update_one(
                    {'_id': order['_id']},
                    {'$set': update}
                )
                print(f"Order {order['_id']} status: {order['status']} -> {new_status}")

            except Exception as e:
                print(f"Provider status check failed for order {order['_id']}: {e}")

    except Exception as e:
        print(f"Provider order check error: {e}")

async def check_provider_health():
    global db_instance
    if db_instance is None:
        return
    try:
        import httpx
        providers = await db_instance.api_providers.find({'status': True}).to_list(200)
        if not providers:
            return
        now = datetime.now(timezone.utc)
        async with httpx.AsyncClient(timeout=10) as client:
            for p in providers:
                try:
                    resp = await client.post(p['apiUrl'], data={'key': p['apiKey'], 'action': 'balance'})
                    result = resp.json()
                    if 'balance' in result:
                        balance = float(result['balance'])
                        await db_instance.api_providers.update_one(
                            {'_id': p['_id']},
                            {'$set': {'lastBalance': balance, 'lastTestedAt': now, 'lastTestOk': True}}
                        )
                    else:
                        await db_instance.api_providers.update_one(
                            {'_id': p['_id']},
                            {'$set': {'lastTestedAt': now, 'lastTestOk': False}}
                        )
                except Exception:
                    await db_instance.api_providers.update_one(
                        {'_id': p['_id']},
                        {'$set': {'lastTestedAt': now, 'lastTestOk': False}}
                    )
    except Exception as e:
        print(f"Provider health check error: {e}")

async def auto_complete_old_orders():
    global db_instance
    if db_instance is None:
        return
    try:
        enabled = await db_instance.site_settings.find_one({'key': 'auto_complete_enabled'})
        hours_setting = await db_instance.site_settings.find_one({'key': 'auto_complete_hours'})
        if not enabled or enabled.get('value') != 'true':
            return
        try:
            hours = float(hours_setting.get('value', '72')) if hours_setting else 72
        except Exception:
            hours = 72
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        orders = await db_instance.orders.find({'status': 'Processing', 'createdAt': {'$lt': cutoff}}).to_list(500)
        if not orders:
            return
        for o in orders:
            await db_instance.orders.update_one({'_id': o['_id']}, {'$set': {'status': 'Completed'}})
            await db_instance.notifications.insert_one({
                'userId': o['userId'],
                'title': 'Order completed',
                'message': 'Your order was automatically marked as completed.',
                'type': 'success',
                'read': False,
                'createdAt': datetime.now(timezone.utc)
            })
            await db_instance.user_activity_logs.insert_one({
                'userId': o['userId'],
                'action': 'Order Completed',
                'details': f'Order {str(o["_id"])} auto-completed',
                'createdAt': datetime.now(timezone.utc)
            })
    except Exception as e:
        print(f"Auto completion error: {e}")

def start_blockchain_scheduler(db, socket_manager=None):
    """Start the blockchain monitoring scheduler"""
    global scheduler, db_instance, socket_manager_instance
    
    db_instance = db
    socket_manager_instance = socket_manager
    
    scheduler = AsyncIOScheduler()
    
    # Check pending payments every 30 seconds
    scheduler.add_job(
        check_pending_sessions,
        IntervalTrigger(seconds=30),
        id='check_pending_payments',
        replace_existing=True
    )
    
    # Expire old sessions every 5 minutes
    scheduler.add_job(
        expire_old_sessions,
        IntervalTrigger(minutes=5),
        id='expire_old_sessions',
        replace_existing=True
    )
    
    # Check provider order statuses every 5 minutes
    scheduler.add_job(
        check_provider_orders,
        IntervalTrigger(minutes=5),
        id='check_provider_orders',
        replace_existing=True
    )

    # Check provider health every 15 minutes
    scheduler.add_job(
        check_provider_health,
        IntervalTrigger(minutes=15),
        id='check_provider_health',
        replace_existing=True
    )

    # Auto-complete orders every hour
    scheduler.add_job(
        auto_complete_old_orders,
        IntervalTrigger(hours=1),
        id='auto_complete_orders',
        replace_existing=True
    )
    
    scheduler.start()
    print("Blockchain scheduler started")

def stop_blockchain_scheduler():
    """Stop the scheduler"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        print("Blockchain scheduler stopped")
