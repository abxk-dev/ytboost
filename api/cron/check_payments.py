"""
Vercel Cron Job: Check pending BEP20 payments
Runs every minute to detect new payments
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
from backend.services.bep20_monitor import check_bep20_payment
from backend.services.webhook_processor import credit_payment


async def check_pending_sessions(db):
    """Check all pending BEP20 payment sessions"""
    try:
        # Get all pending/detecting sessions that are not expired
        grace_raw = os.environ.get("PAYMENT_SESSION_GRACE_MINUTES", "360")
        try:
            grace_minutes = int(float(grace_raw))
        except Exception:
            grace_minutes = 360
        grace_minutes = max(0, min(7 * 24 * 60, grace_minutes))

        cutoff = datetime.now(timezone.utc) - timedelta(minutes=grace_minutes)
        sessions = await db.crypto_payment_sessions.find({
            'status': {'$in': ['pending', 'detecting']},
            'expiresAt': {'$gt': cutoff},
            'network': 'BEP20'
        }).to_list(200)
        
        if not sessions:
            return {'checked': 0, 'credited': 0}
        
        credited_count = 0
        
        # Check each session (process in chunks of 5)
        for i in range(0, len(sessions), 5):
            chunk = sessions[i:i+5]
            tasks = [
                check_bep20_payment(session, db)
                for session in chunk
            ]
            results = await asyncio.gather(*tasks, return_exceptions=True)
            
            # Credit confirmed payments
            for j, result in enumerate(results):
                if isinstance(result, dict) and result.get('confirmations', 0) >= chunk[j].get('requiredConfirms', 1):
                    session = chunk[j]
                    if session.get('status') != 'credited':
                        success = await credit_payment(
                            str(session['_id']),
                            result['amount'],
                            result['txHash'],
                            db
                        )
                        if success:
                            credited_count += 1
                        
        return {'checked': len(sessions), 'credited': credited_count}
                        
    except Exception as e:
        print(f"Scheduler check error: {str(e)}")
        return {'error': str(e)}


async def main():
    """Main function for Vercel serverless"""
    # Verify cron secret
    cron_secret = os.environ.get('CRON_SECRET', '')
    if cron_secret:
        # In Vercel, the cron secret is passed in the Authorization header
        # For now, we'll just check if it's set
        pass
    
    # Connect to MongoDB
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'ytboost')
    mongo_client_kwargs = {}
    if mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
        mongo_client_kwargs["tlsCAFile"] = certifi.where()
    
    client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
    db = client[db_name]
    
    try:
        result = await check_pending_sessions(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'check_pending_payments',
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
