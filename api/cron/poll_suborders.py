"""
Vercel Cron Job: Poll workflow suborders
Runs every 5 minutes to refresh status of workflow suborders
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
from backend.services.workflow_engine import refresh_job_suborders_status


async def poll_workflow_suborders(db):
    """Poll and refresh status of workflow suborders"""
    try:
        jobs = await db.workflow_order_jobs.find(
            {"status": {"$in": ["running", "waiting"]}}
        ).sort("updatedAt", -1).limit(200).to_list(200)
        
        if not jobs:
            return {'checked': 0, 'updated': 0}
        
        updated_count = 0
        for j in jobs:
            try:
                success = await refresh_job_suborders_status(db, j)
                if success:
                    updated_count += 1
            except Exception:
                continue
        
        return {'checked': len(jobs), 'updated': updated_count}
    except Exception as e:
        print(f"Workflow suborder poll error: {e}")
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
        result = await poll_workflow_suborders(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'poll_workflow_suborders',
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
