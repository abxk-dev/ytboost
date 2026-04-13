"""
API Providers Routes - Manage external SMM panel API connections
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime, timezone
from bson import ObjectId
import httpx

router = APIRouter(tags=["API Providers"])

db = None

def set_db(database):
    global db
    db = database

class ProviderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    apiUrl: str = Field(..., min_length=1)
    apiKey: str = Field(..., min_length=1)
    markup: float = 0
    status: bool = True

class ProviderUpdate(BaseModel):
    name: Optional[str] = None
    apiUrl: Optional[str] = None
    apiKey: Optional[str] = None
    markup: Optional[float] = None
    status: Optional[bool] = None

class ProviderTest(BaseModel):
    apiUrl: str
    apiKey: str

def _provider_response(p):
    now = datetime.now(timezone.utc)
    last = p.get('lastTestedAt')
    if isinstance(last, str) and last:
        try:
            last = datetime.fromisoformat(last.replace('Z', '+00:00'))
        except Exception:
            last = None
    if isinstance(last, datetime) and last.tzinfo is None:
        last = last.replace(tzinfo=timezone.utc)
    ok = bool(p.get('lastTestOk', True))
    bal_raw = p.get('lastBalance')
    bal = None
    if bal_raw is not None:
        try:
            bal = float(bal_raw)
        except Exception:
            bal = None
    stale = (not last) or (isinstance(last, datetime) and (now - last).total_seconds() > 3600)
    if stale or not ok:
        health = 'red'
    elif bal is not None and bal < 10:
        health = 'yellow'
    else:
        health = 'green'

    return {
        'id': str(p.get('_id')),
        'name': p.get('name', ''),
        'apiUrl': p.get('apiUrl', ''),
        'apiKey': p.get('apiKey', ''),
        'markup': float(p.get('markup', 0) or 0),
        'status': bool(p.get('status', True)),
        'lastTestedAt': last,
        'lastBalance': bal,
        'lastTestOk': ok,
        'health': health,
        'createdAt': p.get('createdAt'),
    }

@router.get("/admin/api-providers")
async def list_providers(request: Request):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    try:
        providers = await db.api_providers.find({}).to_list(1000)
        result = []
        for p in providers:
            try:
                result.append(_provider_response(p))
            except Exception:
                continue
        return result
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

@router.post("/admin/api-providers")
async def create_provider(request: Request, data: ProviderCreate):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)

    doc = {
        'name': data.name,
        'apiUrl': data.apiUrl.rstrip('/'),
        'apiKey': data.apiKey,
        'markup': data.markup,
        'status': data.status,
        'lastTestedAt': None,
        'lastBalance': None,
        'lastTestOk': False,
        'createdAt': datetime.now(timezone.utc),
    }
    try:
        result = await db.api_providers.insert_one(doc)
        doc['_id'] = result.inserted_id
        return _provider_response(doc)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")

@router.put("/admin/api-providers/{provider_id}")
async def update_provider(request: Request, provider_id: str, data: ProviderUpdate):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(provider_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid provider ID")

    provider = await db.api_providers.find_one({'_id': obj_id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    update = {}
    for field in ['name', 'apiUrl', 'apiKey', 'markup', 'status']:
        val = getattr(data, field, None)
        if val is not None:
            update[field] = val
    if 'apiUrl' in update:
        update['apiUrl'] = update['apiUrl'].rstrip('/')

    if update:
        await db.api_providers.update_one({'_id': obj_id}, {'$set': update})

    updated = await db.api_providers.find_one({'_id': obj_id})
    return _provider_response(updated)

@router.delete("/admin/api-providers/{provider_id}")
async def delete_provider(request: Request, provider_id: str):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(provider_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid provider ID")

    # Check if any services use this provider
    linked = await db.services.count_documents({'providerId': obj_id})
    if linked > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete — {linked} services use this provider. Update those services first.")

    result = await db.api_providers.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Provider not found")

    return {'message': 'Provider deleted'}

@router.post("/admin/api-providers/test")
async def test_provider(request: Request, data: ProviderTest):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)

    url = data.apiUrl.rstrip('/')
    try:
        async with httpx.AsyncClient(timeout=10) as client_http:
            resp = await client_http.post(url, data={'key': data.apiKey, 'action': 'balance'})
            result = resp.json()

        if 'balance' in result:
            return {'success': True, 'balance': float(result['balance'])}
        elif 'error' in result:
            return {'success': False, 'error': result['error']}
        else:
            return {'success': False, 'error': 'Unexpected response from provider'}
    except httpx.TimeoutException:
        return {'success': False, 'error': 'Connection timed out'}
    except Exception as e:
        return {'success': False, 'error': str(e)}

@router.get("/admin/api-providers/{provider_id}/balance")
async def fetch_balance(request: Request, provider_id: str):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(provider_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid provider ID")

    provider = await db.api_providers.find_one({'_id': obj_id})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")

    try:
        async with httpx.AsyncClient(timeout=10) as client_http:
            resp = await client_http.post(provider['apiUrl'], data={'key': provider['apiKey'], 'action': 'balance'})
            result = resp.json()

        if 'balance' in result:
            balance = float(result['balance'])
            await db.api_providers.update_one(
                {'_id': obj_id},
                {'$set': {'lastBalance': balance, 'lastTestedAt': datetime.now(timezone.utc)}}
            )
            return {'success': True, 'balance': balance}
        else:
            return {'success': False, 'error': result.get('error', 'Unknown error')}
    except Exception as e:
        return {'success': False, 'error': str(e)}
