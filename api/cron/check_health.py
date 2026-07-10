"""
Vercel Cron Job: Check provider health
Runs every 15 minutes to verify provider connectivity and balance
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


async def check_provider_health(db):
    """Check health of all active providers"""
    try:
        from backend.services.smm_http import post_smm_api
        providers = await db.api_providers.find({'status': True}).to_list(200)
        if not providers:
            return {'checked': 0, 'healthy': 0, 'unhealthy': 0}
        
        healthy = 0
        unhealthy = 0
        now = datetime.now(timezone.utc)
        
        for p in providers:
            try:
                result, _err, _u, _h = await post_smm_api(
                    p['apiUrl'],
                    {'key': p['apiKey'], 'action': 'balance'},
                    timeout=20.0,
                )
                if _err or not isinstance(result, dict) or 'balance' not in result:
                    await db.api_providers.update_one(
                        {'_id': p['_id']},
                        {'$set': {'lastTestedAt': now, 'lastTestOk': False}}
                    )
                    unhealthy += 1
                    continue
                balance = float(result['balance'])
                await db.api_providers.update_one(
                    {'_id': p['_id']},
                    {'$set': {'lastBalance': balance, 'lastTestedAt': now, 'lastTestOk': True}}
                )
                healthy += 1
            except Exception:
                await db.api_providers.update_one(
                    {'_id': p['_id']},
                    {'$set': {'lastTestedAt': now, 'lastTestOk': False}}
                )
                unhealthy += 1
        
        return {'checked': len(providers), 'healthy': healthy, 'unhealthy': unhealthy}
    except Exception as e:
        print(f"Provider health check error: {e}")
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
        result = await check_provider_health(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'check_provider_health',
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
