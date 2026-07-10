"""
Vercel Cron Job: Check provider order statuses
Runs every 5 minutes to update order statuses from external providers
"""
import sys
from pathlib import Path
from datetime import datetime, timezone
import os
import asyncio

# Add project root to Python path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / 'backend' / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
import certifi

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


async def check_provider_orders(db):
    """Check status of auto-fulfilled orders from external providers"""
    try:
        from backend.services.smm_http import post_smm_api

        orders = await db.orders.find({
            'fulfillmentType': 'auto',
            'providerOrderId': {'$ne': '', '$exists': True},
            'status': {'$in': ['Pending', 'Processing', 'In Progress']},
        }).to_list(200)

        if not orders:
            return {'checked': 0, 'updated': 0}

        updated_count = 0
        provider_cache = {}
        
        for order in orders:
            service = await db.services.find_one({'_id': order['serviceId']})
            if not service or not service.get('providerId'):
                continue
            pid = service['providerId']
            if pid not in provider_cache:
                provider = await db.api_providers.find_one({'_id': pid})
                if provider and provider.get('status', True):
                    provider_cache[pid] = provider

            provider = provider_cache.get(pid)
            if not provider:
                continue

            try:
                result, _err, _u, _h = await post_smm_api(
                    provider['apiUrl'],
                    {
                        'key': provider['apiKey'],
                        'action': 'status',
                        'order': order['providerOrderId'],
                    },
                    timeout=20.0,
                )
                if _err or not isinstance(result, dict):
                    continue

                new_status = STATUS_MAP.get(result.get('status', ''))
                if not new_status or new_status == order['status']:
                    continue

                update = {'status': new_status}
                if 'start_count' in result:
                    update['startCount'] = int(result['start_count'])
                if 'remains' in result:
                    update['remains'] = int(result['remains'])

                await db.orders.update_one(
                    {'_id': order['_id']},
                    {'$set': update}
                )
                updated_count += 1
                print(f"Order {order['_id']} status: {order['status']} -> {new_status}")

            except Exception as e:
                print(f"Provider status check failed for order {order['_id']}: {e}")

        return {'checked': len(orders), 'updated': updated_count}

    except Exception as e:
        print(f"Provider order check error: {e}")
        return {'error': str(e)}


async def main():
    """Main function for Vercel serverless"""
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'ytboost')
    mongo_client_kwargs = {}
    if mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
        mongo_client_kwargs["tlsCAFile"] = certifi.where()
    
    client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
    db = client[db_name]
    
    try:
        result = await check_provider_orders(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'check_provider_orders',
                'timestamp': datetime.now(timezone.utc).isoformat(),
                **result
            }
        }
    finally:
        client.close()


def handler(request, response):
    """Vercel serverless handler"""
    result = asyncio.run(main())
    response.status_code = result.get('statusCode', 200)
    response.headers['Content-Type'] = 'application/json'
    return result.get('body', {})
