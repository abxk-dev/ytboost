"""
Services Routes - CRUD for SMM services
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

from backend.smm.jap_v2 import jap_service_number

router = APIRouter(tags=["Services"])

# Request models
class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    sid: Optional[int] = None
    categoryId: str
    description: str = ""
    rate: float = Field(..., gt=0)
    minQty: int = Field(..., gt=0)
    maxQty: int = Field(..., gt=0)
    type: str = "Default"
    status: bool = True
    startTime: str = ""
    speed: str = ""
    refillTime: str = ""
    quality: str = ""
    country: str = ""
    refillEnabled: bool = False
    packagePrice: Optional[float] = None
    packageDescription: str = ""
    fulfillmentType: str = "manual"
    providerId: Optional[str] = None
    providerServiceId: Optional[str] = None
    displaySpeedMin: Optional[int] = None
    displaySpeedMax: Optional[int] = None
    displaySpeedUnit: str = ""

class ServiceUpdate(BaseModel):
    sid: Optional[int] = None
    name: Optional[str] = None
    categoryId: Optional[str] = None
    description: Optional[str] = None
    rate: Optional[float] = None
    minQty: Optional[int] = None
    maxQty: Optional[int] = None
    type: Optional[str] = None
    status: Optional[bool] = None
    startTime: Optional[str] = None
    speed: Optional[str] = None
    refillTime: Optional[str] = None
    quality: Optional[str] = None
    country: Optional[str] = None
    refillEnabled: Optional[bool] = None
    packagePrice: Optional[float] = None
    packageDescription: Optional[str] = None
    fulfillmentType: Optional[str] = None
    providerId: Optional[str] = None
    providerServiceId: Optional[str] = None
    displaySpeedMin: Optional[int] = None
    displaySpeedMax: Optional[int] = None
    displaySpeedUnit: Optional[str] = None

class MappingUpdate(BaseModel):
    providerId: Optional[str] = None
    providerServiceId: Optional[str] = None

class BulkServiceUpdate(BaseModel):
    ids: list[str]
    categoryId: Optional[str] = None
    status: Optional[bool] = None

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def _service_fields(svc):
    """
    Includes `serviceNumber` — same integer as /api/v2 action=services field `service`
    (JAP / reseller panels). Use this everywhere the panel-facing id is shown.
    """
    if not isinstance(svc, dict) or svc.get("_id") is None:
        sn = 0
    else:
        try:
            sn = jap_service_number(svc)
        except (TypeError, ValueError, KeyError):
            sn = 0
    return {
        'serviceNumber': sn,
        'sid': svc.get('sid'),
        'startTime': svc.get('startTime', ''),
        'speed': svc.get('speed', ''),
        'refillTime': svc.get('refillTime', ''),
        'quality': svc.get('quality', ''),
        'country': svc.get('country', ''),
        'refillEnabled': svc.get('refillEnabled', False),
        'packagePrice': svc.get('packagePrice'),
        'packageDescription': svc.get('packageDescription', ''),
        'fulfillmentType': svc.get('fulfillmentType', 'manual'),
        'providerId': str(svc['providerId']) if svc.get('providerId') else None,
        'providerServiceId': svc.get('providerServiceId', ''),
        'displaySpeedMin': svc.get('displaySpeedMin'),
        'displaySpeedMax': svc.get('displaySpeedMax'),
        'displaySpeedUnit': svc.get('displaySpeedUnit', ''),
    }

# Public routes
@router.get("/services")
async def get_services():
    """Get all active services grouped by category (public)"""
    services = await db.services.find({'status': True}).to_list(1000)
    
    result = []
    for svc in services:
        cat = await db.categories.find_one({'_id': svc['categoryId']})
        result.append({
            'id': str(svc['_id']),
            'name': svc['name'],
            'categoryId': str(svc['categoryId']),
            'categoryName': cat['name'] if cat else 'Unknown',
            'description': svc.get('description', ''),
            'rate': svc['rate'],
            'minQty': svc['minQty'],
            'maxQty': svc['maxQty'],
            'type': svc.get('type', 'Default'),
            **_service_fields(svc)
        })
    
    return result

@router.get("/services/live-speeds")
async def get_live_speeds():
    categories = await db.categories.find({'status': True}, {'_id': 1, 'name': 1, 'slug': 1}).sort([('order', 1), ('createdAt', 1)]).to_list(1000)
    services = await db.services.find({'status': True}, {'_id': 1, 'categoryId': 1, 'displaySpeedMin': 1, 'displaySpeedMax': 1, 'displaySpeedUnit': 1}).to_list(5000)
    by_cat = {}
    for svc in services:
        cid = svc.get('categoryId')
        if not cid:
            continue
        by_cat.setdefault(cid, []).append(svc)

    result = []
    for cat in categories:
        svcs = by_cat.get(cat['_id'], [])
        mins = [s.get('displaySpeedMin') for s in svcs if s.get('displaySpeedMin') is not None]
        maxs = [s.get('displaySpeedMax') for s in svcs if s.get('displaySpeedMax') is not None]
        unit = ''
        for s in svcs:
            if s.get('displaySpeedUnit'):
                unit = s.get('displaySpeedUnit', '')
                break
        result.append({
            'categoryId': str(cat['_id']),
            'categoryName': cat.get('name', ''),
            'displaySpeedMin': int(min(mins)) if mins else 0,
            'displaySpeedMax': int(max(maxs)) if maxs else 0,
            'displaySpeedUnit': unit or ''
        })
    return result

@router.get("/services/user")
async def get_user_services(request: Request):
    """Get services with user's special rates (authenticated)"""
    from backend.middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    # Get all active services
    services = await db.services.find({'status': True}).to_list(1000)
    
    # Get user's special services
    special_services = await db.user_special_services.find({
        'userId': user_id,
        'status': True
    }).to_list(100)
    
    special_map = {str(ss['serviceId']): ss for ss in special_services}
    
    result = []
    
    # Add special services first (with star)
    for ss in special_services:
        svc = await db.services.find_one({'_id': ss['serviceId'], 'status': True})
        if svc:
            cat = await db.categories.find_one({'_id': svc['categoryId']})
            row = {
                'id': str(svc['_id']),
                'name': svc['name'],
                'categoryId': str(svc['categoryId']),
                'categoryName': cat['name'] if cat else 'Unknown',
                'description': svc.get('description', ''),
                'rate': ss['customRate'],  # Use custom rate
                'publicRate': svc.get('rate', ss['customRate']),
                'minQty': ss.get('minQty', svc['minQty']),
                'maxQty': ss.get('maxQty', svc['maxQty']),
                'type': svc.get('type', 'Default'),
                'isSpecial': True,
                **_service_fields(svc),
            }
            # Always re-set (same as admin + /api/v2) so list never misses ids
            row['sid'] = svc.get('sid')
            row['serviceNumber'] = jap_service_number(svc)
            result.append(row)
    
    # Add regular services (excluding special ones)
    for svc in services:
        svc_id = str(svc['_id'])
        if svc_id not in special_map:
            cat = await db.categories.find_one({'_id': svc['categoryId']})
            row = {
                'id': svc_id,
                'name': svc['name'],
                'categoryId': str(svc['categoryId']),
                'categoryName': cat['name'] if cat else 'Unknown',
                'description': svc.get('description', ''),
                'rate': svc['rate'],
                'publicRate': svc['rate'],
                'minQty': svc['minQty'],
                'maxQty': svc['maxQty'],
                'type': svc.get('type', 'Default'),
                'isSpecial': False,
                **_service_fields(svc),
            }
            row['sid'] = svc.get('sid')
            row['serviceNumber'] = jap_service_number(svc)
            result.append(row)
    
    return result

# Admin routes
@router.get("/admin/services")
async def admin_get_services(request: Request):
    """Get all services (admin) with category + provider mapping details."""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    services = await db.services.find({}).to_list(5000)
    cats = {c['_id']: c for c in await db.categories.find({}).to_list(2000)}
    provs = {p['_id']: p for p in await db.api_providers.find({}, {'name': 1, 'status': 1}).to_list(500)}

    result = []
    for svc in services:
        cat = cats.get(svc.get('categoryId'))
        prov_id = svc.get('providerId')
        prov = provs.get(prov_id) if prov_id else None
        provider_service_id = svc.get('providerServiceId', '') or ''
        if prov_id and provider_service_id and prov:
            mapping_state = 'mapped'
        elif prov_id and not prov:
            mapping_state = 'broken'  # provider was deleted
        elif prov_id or provider_service_id:
            mapping_state = 'partial'
        else:
            mapping_state = 'unmapped'
        row = {
            'id': str(svc['_id']),
            'name': svc['name'],
            'categoryId': str(svc['categoryId']),
            'categoryName': cat['name'] if cat else 'Unknown',
            'description': svc.get('description', ''),
            'rate': svc['rate'],
            'minQty': svc['minQty'],
            'maxQty': svc['maxQty'],
            'type': svc.get('type', 'Default'),
            'status': svc.get('status', True),
            'createdAt': svc.get('createdAt'),
            'providerName': prov['name'] if prov else '',
            'mappingState': mapping_state,
            **_service_fields(svc),
        }
        row['sid'] = svc.get('sid')
        row['serviceNumber'] = jap_service_number(svc)
        result.append(row)

    return result

@router.patch("/admin/services/{service_id}/mapping")
async def admin_update_service_mapping(request: Request, service_id: str, data: MappingUpdate):
    """Set, change or clear the provider mapping of one service."""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(service_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid service ID")
    if not await db.services.find_one({'_id': obj_id}):
        raise HTTPException(status_code=404, detail="Service not found")

    provider_id = (data.providerId or '').strip()
    provider_service_id = (data.providerServiceId or '').strip()

    if not provider_id and not provider_service_id:
        update = {'providerId': None, 'providerServiceId': '', 'fulfillmentType': 'manual'}
        provider_name = ''
    else:
        if not provider_id or not provider_service_id:
            raise HTTPException(status_code=400, detail="Select a provider and enter the provider service ID")
        try:
            prov_obj = ObjectId(provider_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid provider ID")
        prov = await db.api_providers.find_one({'_id': prov_obj})
        if not prov:
            raise HTTPException(status_code=400, detail="Provider not found")
        update = {'providerId': prov_obj, 'providerServiceId': provider_service_id, 'fulfillmentType': 'auto'}
        provider_name = prov.get('name', '')

    await db.services.update_one({'_id': obj_id}, {'$set': update})
    return {
        'message': 'Mapping updated',
        'providerId': provider_id or None,
        'providerName': provider_name,
        'providerServiceId': provider_service_id,
        'fulfillmentType': update['fulfillmentType'],
    }

@router.post("/admin/services/bulk-update")
async def admin_bulk_update_services(request: Request, data: BulkServiceUpdate):
    """Move many services to a category and/or enable/disable them in one call."""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    if not data.ids:
        raise HTTPException(status_code=400, detail="No services selected")
    try:
        obj_ids = [ObjectId(i) for i in data.ids]
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid service ID in list")

    update = {}
    if data.categoryId is not None:
        try:
            cat_id = ObjectId(data.categoryId)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid category ID")
        if not await db.categories.find_one({'_id': cat_id}):
            raise HTTPException(status_code=400, detail="Category not found")
        update['categoryId'] = cat_id
    if data.status is not None:
        update['status'] = data.status
    if not update:
        raise HTTPException(status_code=400, detail="Nothing to update")

    res = await db.services.update_many({'_id': {'$in': obj_ids}}, {'$set': update})
    return {'matched': res.matched_count, 'modified': res.modified_count}

@router.post("/admin/services/seed-defaults")
async def admin_seed_default_services(request: Request):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})

    from seed import seed_database
    await seed_database(db)

    cats = await db.categories.count_documents({})
    svcs = await db.services.count_documents({})
    await log_admin_action(db, request, admin, "SERVICES_SEEDED_DEFAULTS", f"categories={cats}, services={svcs}")
    return {"message": "Defaults seeded", "categories": cats, "services": svcs}

@router.post("/admin/services")
async def admin_create_service(request: Request, data: ServiceCreate):
    """Create new service (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        cat_id = ObjectId(data.categoryId)
    except:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    try:
        category = await db.categories.find_one({'_id': cat_id})
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
    if not category:
        raise HTTPException(status_code=400, detail="Category not found")
    
    if data.minQty > data.maxQty:
        raise HTTPException(status_code=400, detail="Min quantity cannot be greater than max quantity")
    
    service_doc = {
        'name': data.name,
        'categoryId': cat_id,
        'description': data.description,
        'rate': data.rate,
        'minQty': data.minQty,
        'maxQty': data.maxQty,
        'type': data.type,
        'status': data.status,
        'startTime': data.startTime,
        'speed': data.speed,
        'refillTime': data.refillTime,
        'quality': data.quality,
        'country': data.country,
        'refillEnabled': data.refillEnabled,
        'packagePrice': data.packagePrice,
        'packageDescription': data.packageDescription,
        'fulfillmentType': data.fulfillmentType,
        'providerId': ObjectId(data.providerId) if data.providerId else None,
        'providerServiceId': data.providerServiceId or '',
        'displaySpeedMin': data.displaySpeedMin,
        'displaySpeedMax': data.displaySpeedMax,
        'displaySpeedUnit': data.displaySpeedUnit or '',
        'createdAt': datetime.now(timezone.utc)
    }
    
    # Generate unique random 3-digit sid
    import random
    for _ in range(100):
        candidate = random.randint(100, 999)
        existing = await db.services.find_one({'sid': candidate})
        if not existing:
            service_doc['sid'] = candidate
            break
    else:
        # fallback: use timestamp-based
        service_doc['sid'] = int(datetime.now(timezone.utc).timestamp()) % 900 + 100
    
    try:
        result = await db.services.insert_one(service_doc)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
    
    return {
        'id': str(result.inserted_id),
        'sid': service_doc.get('sid'),
        'name': data.name,
        'categoryId': data.categoryId,
        'categoryName': category['name'],
        'rate': data.rate,
        'minQty': data.minQty,
        'maxQty': data.maxQty,
        'type': data.type,
        'status': data.status
    }

@router.put("/admin/services/{service_id}")
async def admin_update_service(request: Request, service_id: str, data: ServiceUpdate):
    """Update service (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(service_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid service ID")
    
    service = await db.services.find_one({'_id': obj_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_data = {}
    if data.name is not None:
        update_data['name'] = data.name
    if data.categoryId is not None:
        try:
            cat_id = ObjectId(data.categoryId)
            category = await db.categories.find_one({'_id': cat_id})
            if not category:
                raise HTTPException(status_code=400, detail="Category not found")
            update_data['categoryId'] = cat_id
        except:
            raise HTTPException(status_code=400, detail="Invalid category ID")
    if data.description is not None:
        update_data['description'] = data.description
    if data.rate is not None:
        update_data['rate'] = data.rate
    if data.minQty is not None:
        update_data['minQty'] = data.minQty
    if data.maxQty is not None:
        update_data['maxQty'] = data.maxQty
    if data.type is not None:
        update_data['type'] = data.type
    if data.status is not None:
        update_data['status'] = data.status
    for field in ['startTime', 'speed', 'refillTime', 'quality', 'country', 'packageDescription']:
        val = getattr(data, field, None)
        if val is not None:
            update_data[field] = val
    for field in ['displaySpeedMin', 'displaySpeedMax', 'displaySpeedUnit']:
        val = getattr(data, field, None)
        if val is not None:
            update_data[field] = val
    if data.refillEnabled is not None:
        update_data['refillEnabled'] = data.refillEnabled
    if data.packagePrice is not None:
        update_data['packagePrice'] = data.packagePrice
    if data.fulfillmentType is not None:
        update_data['fulfillmentType'] = data.fulfillmentType
    if data.providerId is not None:
        update_data['providerId'] = ObjectId(data.providerId) if data.providerId else None
    if data.providerServiceId is not None:
        update_data['providerServiceId'] = data.providerServiceId
    
    if update_data:
        await db.services.update_one({'_id': obj_id}, {'$set': update_data})
    
    return {'message': 'Service updated successfully'}

@router.delete("/admin/services/{service_id}")
async def admin_delete_service(request: Request, service_id: str):
    """Delete service (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(service_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid service ID")
    
    result = await db.services.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Also delete related special services
    await db.user_special_services.delete_many({'serviceId': obj_id})
    
    return {'message': 'Service deleted successfully'}

@router.patch("/admin/services/{service_id}/status")
async def admin_toggle_service_status(request: Request, service_id: str):
    """Toggle service status (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(service_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid service ID")
    
    service = await db.services.find_one({'_id': obj_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    new_status = not service.get('status', True)
    await db.services.update_one({'_id': obj_id}, {'$set': {'status': new_status}})
    
    return {'status': new_status}
