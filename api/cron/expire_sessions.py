"""
Vercel Cron Job: Expire old payment sessions
Runs every 5 minutes to expire timed-out sessions
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


async def expire_old_sessions(db):
    """Expire sessions that have timed out"""
    try:
        grace_raw = os.environ.get("PAYMENT_SESSION_GRACE_MINUTES", "360")
        try:
            grace_minutes = int(float(grace_raw))
        except Exception:
            grace_minutes = 360
        grace_minutes = max(0, min(7 * 24 * 60, grace_minutes))

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=grace_minutes)
        result = await db.crypto_payment_sessions.update_many(
            {
                'status': {'$in': ['pending', 'detecting']},
                'expiresAt': {'$lt': cutoff}
            },
            {'$set': {'status': 'expired'}}
        )
        
        return {'expired': result.modified_count}
            
    except Exception as e:
        print(f"Expire sessions error: {str(e)}")
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
        result = await expire_old_sessions(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'expire_old_sessions',
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
