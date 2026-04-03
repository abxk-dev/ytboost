"""
Blockchain Scheduler Service
Background job that polls BSC every 30 seconds for pending payments
"""
import asyncio
from datetime import datetime, timezone
from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.interval import IntervalTrigger
from services.bep20_monitor import check_bep20_payment
from services.webhook_processor import credit_payment

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
        sessions = await db_instance.crypto_payment_sessions.find({
            'status': {'$in': ['pending', 'detecting']},
            'expiresAt': {'$gt': datetime.now(timezone.utc)},
            'network': 'BEP20'
        }).to_list(100)
        
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
        result = await db_instance.crypto_payment_sessions.update_many(
            {
                'status': 'pending',
                'expiresAt': {'$lt': datetime.now(timezone.utc)}
            },
            {'$set': {'status': 'expired'}}
        )
        
        if result.modified_count > 0:
            print(f"⏰ Expired {result.modified_count} payment sessions")
            
    except Exception as e:
        print(f"Expire sessions error: {str(e)}")

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
    
    scheduler.start()
    print("✅ Blockchain scheduler started")

def stop_blockchain_scheduler():
    """Stop the scheduler"""
    global scheduler
    if scheduler:
        scheduler.shutdown()
        print("Blockchain scheduler stopped")
