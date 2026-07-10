"""
Vercel Cron Job: Resume waiting workflow jobs
Runs every minute to resume workflow jobs that are due
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
from backend.services.workflow_engine import resume_waiting_job_if_due


async def resume_waiting_workflow_jobs(db):
    """Resume workflow jobs that are waiting and due"""
    try:
        now = datetime.now(timezone.utc)
        jobs = await db.workflow_order_jobs.find(
            {
                "status": "waiting",
                "$or": [
                    {"scheduledFor": {"$lte": now}},
                    {"scheduledFor": None},
                ],
            }
        ).sort("createdAt", 1).limit(200).to_list(200)
        
        if not jobs:
            return {'checked': 0, 'resumed': 0}
        
        resumed_count = 0
        for j in jobs:
            try:
                success = await resume_waiting_job_if_due(db, j)
                if success:
                    resumed_count += 1
            except Exception:
                continue
        
        return {'checked': len(jobs), 'resumed': resumed_count}
    except Exception as e:
        print(f"Workflow resume error: {e}")
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
        result = await resume_waiting_workflow_jobs(db)
        return {
            'statusCode': 200,
            'body': {
                'job': 'resume_waiting_workflow_jobs',
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
