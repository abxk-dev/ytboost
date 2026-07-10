"""
Vercel Cron Job: Run all background tasks
Combined endpoint for Hobby plan (1 cron limit)
"""
import sys
from pathlib import Path
from datetime import datetime, timezone
import os
import asyncio
import certifi

ROOT_DIR = Path(__file__).parent.parent.parent
sys.path.insert(0, str(ROOT_DIR))

from dotenv import load_dotenv
load_dotenv(ROOT_DIR / 'backend' / '.env')

from motor.motor_asyncio import AsyncIOMotorClient

from api.cron.check_payments import check_pending_sessions
from api.cron.expire_sessions import expire_old_sessions
from api.cron.check_orders import check_order_statuses
from api.cron.check_health import check_provider_health
from api.cron.auto_complete import auto_complete_orders
from api.cron.resume_workflows import resume_waiting_workflows
from api.cron.poll_suborders import poll_workflow_suborders


async def get_db():
    mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
    db_name = os.environ.get('DB_NAME', 'ytboost')
    mongo_client_kwargs = {}
    if mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
        mongo_client_kwargs["tlsCAFile"] = certifi.where()
    client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
    return client[db_name]


async def main():
    db = await get_db()
    results = {}
    try:
        results['check_payments'] = await check_pending_sessions(db)
    except Exception as e:
        results['check_payments'] = {'error': str(e)}

    try:
        results['expire_sessions'] = await expire_old_sessions(db)
    except Exception as e:
        results['expire_sessions'] = {'error': str(e)}

    try:
        results['check_orders'] = await check_order_statuses(db)
    except Exception as e:
        results['check_orders'] = {'error': str(e)}

    try:
        results['check_health'] = await check_provider_health(db)
    except Exception as e:
        results['check_health'] = {'error': str(e)}

    try:
        results['auto_complete'] = await auto_complete_orders(db)
    except Exception as e:
        results['auto_complete'] = {'error': str(e)}

    try:
        results['resume_workflows'] = await resume_waiting_workflows(db)
    except Exception as e:
        results['resume_workflows'] = {'error': str(e)}

    try:
        results['poll_suborders'] = await poll_workflow_suborders(db)
    except Exception as e:
        results['poll_suborders'] = {'error': str(e)}

    return {
        'statusCode': 200,
        'body': {
            'job': 'run_all_cron',
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'results': results
        }
    }


def handler(request, response):
    result = asyncio.run(main())
    response.status_code = result.get('statusCode', 200)
    response.headers['Content-Type'] = 'application/json'
    return result.get('body', {})
