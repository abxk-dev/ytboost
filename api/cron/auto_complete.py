"""
Vercel Cron Job: Auto-complete old orders
Runs every hour to complete orders that have been processing too long
"""
import sys
from pathlib import Path
from datetime import datetime, timezone, timedelta
import os
import asyncio

# Add project root to Python path
ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / 'backend' / '.env')

from motor.motor_asyncio import AsyncIOMotorClient
import certifi


async def auto_complete_old_orders(db):
    """Auto-complete orders that have been processing too long"""
    try:
        enabled = await db.site_settings.find_one({'key': 'auto_complete_enabled'})
        hours_setting = await db.site_settings.find_one({'key': 'auto_complete_hours'})
        if not enabled or enabled.get('value') != 'true':
            return {'enabled': False, 'completed': 0}
        
        try:
            hours = float(hours_setting.get('value', '72')) if hours_setting else 72
        except Exception:
            hours = 72
        
        cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
        orders = await db.orders.find({'status': 'Processing', 'createdAt': {'$lt': cutoff}}).to_list(500)
        
        if not orders:
            return {'enabled': True, 'completed': 0}
        
        completed_count = 0
        for o in orders:
            await db.orders.update_one({'_id': o['_id']}, {'$set': {'status': 'Completed'}})
            await db.notifications.insert_one({
                'userId': o['userId'],
                'title': 'Order completed',
                'message': 'Your order was automatically marked as completed.',
                'type': 'success',
                'read': False,
                'createdAt': datetime.now(timezone.utc)
            })
            await db.user_activity_logs.insert_one({
                'userId': o['userId'],
                'action': 'Order Completed',
                'details': f'Order {str(o["_id"])} auto-completed',
                'createdAt': datetime.now(timezone.utc)
            })
            completed_count += 1
        
        return {'enabled': True, 'completed': completed_count}
    except Exception as e:
        print(f"Auto completion error: {e}")
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
        result = await auto_complete_old_orders(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'auto_complete_orders',
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
