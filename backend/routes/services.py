"""
Services Routes - CRUD for SMM services
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

router = APIRouter(tags=["Services"])

# Request models
class ServiceCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
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

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def _service_fields(svc):
    """Common service field extractor"""
    return {
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
    from middleware.auth import get_current_user
    
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
            result.append({
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
                **_service_fields(svc)
            })
    
    # Add regular services (excluding special ones)
    for svc in services:
        svc_id = str(svc['_id'])
        if svc_id not in special_map:
            cat = await db.categories.find_one({'_id': svc['categoryId']})
            result.append({
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
                **_service_fields(svc)
            })
    
    return result

# Admin routes
@router.get("/admin/services")
async def admin_get_services(request: Request):
    """Get all services (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    services = await db.services.find({}).to_list(1000)
    
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
            'status': svc.get('status', True),
            'createdAt': svc.get('createdAt'),
            **_service_fields(svc)
        })
    
    return result

@router.post("/admin/services/seed-defaults")
async def admin_seed_default_services(request: Request):
    from middleware.admin import get_current_admin, require_admin_role, log_admin_action
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
    from middleware.admin import get_current_admin
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
    
    try:
        result = await db.services.insert_one(service_doc)
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"Database unavailable: {e}")
    
    return {
        'id': str(result.inserted_id),
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
    from middleware.admin import get_current_admin
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
    from middleware.admin import get_current_admin
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
    from middleware.admin import get_current_admin
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
