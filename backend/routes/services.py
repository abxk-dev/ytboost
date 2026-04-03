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

class ServiceUpdate(BaseModel):
    name: Optional[str] = None
    categoryId: Optional[str] = None
    description: Optional[str] = None
    rate: Optional[float] = None
    minQty: Optional[int] = None
    maxQty: Optional[int] = None
    type: Optional[str] = None
    status: Optional[bool] = None

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

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
            'type': svc.get('type', 'Default')
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
    
    # Add special services first (with ⭐)
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
                'minQty': ss.get('minQty', svc['minQty']),
                'maxQty': ss.get('maxQty', svc['maxQty']),
                'type': svc.get('type', 'Default'),
                'isSpecial': True
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
                'minQty': svc['minQty'],
                'maxQty': svc['maxQty'],
                'type': svc.get('type', 'Default'),
                'isSpecial': False
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
            'createdAt': svc.get('createdAt')
        })
    
    return result

@router.post("/admin/services")
async def admin_create_service(request: Request, data: ServiceCreate):
    """Create new service (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        cat_id = ObjectId(data.categoryId)
    except:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    # Verify category exists
    category = await db.categories.find_one({'_id': cat_id})
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
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.services.insert_one(service_doc)
    
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
