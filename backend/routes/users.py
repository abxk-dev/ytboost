"""
Users Routes - Admin user management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional

router = APIRouter(tags=["Users"])

# Request models
class BalanceUpdate(BaseModel):
    amount: float
    type: str = Field(..., pattern="^(add|deduct)$")
    note: Optional[str] = None

class SpecialServiceCreate(BaseModel):
    serviceId: str
    customRate: float = Field(..., gt=0)
    minQty: Optional[int] = None
    maxQty: Optional[int] = None
    status: bool = True
    note: Optional[str] = None

# Dependency injection placeholder
db = None
socket_manager = None

def set_db(database):
    global db
    db = database

def set_socket_manager(manager):
    global socket_manager
    socket_manager = manager

# Admin routes
@router.get("/admin/users")
async def admin_get_users(request: Request, page: int = 1, limit: int = 50, search: str = None, status: str = None):
    """Get all users (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Build query
    query = {'role': {'$ne': 'admin'}}  # Exclude admins
    if search:
        query['$or'] = [
            {'name': {'$regex': search, '$options': 'i'}},
            {'email': {'$regex': search, '$options': 'i'}}
        ]
    if status:
        query['status'] = status
    
    total = await db.users.count_documents(query)
    
    skip = (page - 1) * limit
    users = await db.users.find(query, {'password': 0}).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for user in users:
        # Get order count
        order_count = await db.orders.count_documents({'userId': user['_id']})
        result.append({
            'id': str(user['_id']),
            'name': user['name'],
            'email': user['email'],
            'balance': user.get('balance', 0),
            'status': user.get('status', 'active'),
            'ordersCount': order_count,
            'createdAt': user.get('createdAt')
        })
    
    return {
        'users': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.get("/admin/users/{user_id}")
async def admin_get_user(request: Request, user_id: str):
    """Get single user details (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({'_id': obj_id}, {'password': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    order_count = await db.orders.count_documents({'userId': obj_id})
    total_spent = await db.transactions.aggregate([
        {'$match': {'userId': obj_id, 'type': 'debit'}},
        {'$group': {'_id': None, 'total': {'$sum': '$amount'}}}
    ]).to_list(1)
    
    return {
        'id': str(user['_id']),
        'name': user['name'],
        'email': user['email'],
        'balance': user.get('balance', 0),
        'status': user.get('status', 'active'),
        'apiKey': user.get('apiKey'),
        'ordersCount': order_count,
        'totalSpent': total_spent[0]['total'] if total_spent else 0,
        'createdAt': user.get('createdAt')
    }

@router.put("/admin/users/{user_id}/balance")
async def admin_update_user_balance(request: Request, user_id: str, data: BalanceUpdate):
    """Update user balance (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_balance = user.get('balance', 0)
    
    if data.type == 'add':
        new_balance = current_balance + data.amount
        tx_type = 'credit'
        description = f'Admin credit: {data.note or "Balance adjustment"}'
    else:
        if data.amount > current_balance:
            raise HTTPException(status_code=400, detail="Cannot deduct more than current balance")
        new_balance = current_balance - data.amount
        tx_type = 'debit'
        description = f'Admin debit: {data.note or "Balance adjustment"}'
    
    # Update balance
    await db.users.update_one({'_id': obj_id}, {'$set': {'balance': new_balance}})
    
    # Create transaction record
    await db.transactions.insert_one({
        'userId': obj_id,
        'type': tx_type,
        'amount': data.amount,
        'description': description,
        'balanceAfter': new_balance,
        'createdAt': datetime.now(timezone.utc)
    })
    
    # Emit socket event to update user's balance in UI
    if socket_manager:
        await socket_manager.emit(
            'balance_updated',
            {'balance': new_balance},
            room=f'user-{user_id}'
        )
    
    return {
        'message': 'Balance updated',
        'newBalance': new_balance
    }

@router.put("/admin/users/{user_id}/status")
async def admin_update_user_status(request: Request, user_id: str):
    """Toggle user ban status (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_status = user.get('status', 'active')
    new_status = 'banned' if current_status == 'active' else 'active'
    
    await db.users.update_one({'_id': obj_id}, {'$set': {'status': new_status}})
    
    return {'status': new_status}

# Special services per user
@router.get("/admin/users/{user_id}/special-services")
async def admin_get_user_special_services(request: Request, user_id: str):
    """Get user's special services (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    
    user = await db.users.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    special_services = await db.user_special_services.find({'userId': obj_id}).to_list(100)
    
    result = []
    for ss in special_services:
        service = await db.services.find_one({'_id': ss['serviceId']})
        if service:
            result.append({
                'id': str(ss['_id']),
                'serviceId': str(ss['serviceId']),
                'serviceName': service['name'],
                'originalRate': service['rate'],
                'customRate': ss['customRate'],
                'minQty': ss.get('minQty', service['minQty']),
                'maxQty': ss.get('maxQty', service['maxQty']),
                'status': ss.get('status', True),
                'note': ss.get('note')
            })
    
    return {
        'user': {
            'id': str(user['_id']),
            'name': user['name'],
            'email': user['email']
        },
        'specialServices': result
    }

@router.post("/admin/users/{user_id}/special-services")
async def admin_create_user_special_service(request: Request, user_id: str, data: SpecialServiceCreate):
    """Assign special service to user (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        user_obj_id = ObjectId(user_id)
        service_obj_id = ObjectId(data.serviceId)
    except:
        raise HTTPException(status_code=400, detail="Invalid ID")
    
    # Verify user exists
    user = await db.users.find_one({'_id': user_obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Verify service exists
    service = await db.services.find_one({'_id': service_obj_id})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check if already assigned
    existing = await db.user_special_services.find_one({
        'userId': user_obj_id,
        'serviceId': service_obj_id
    })
    if existing:
        raise HTTPException(status_code=400, detail="Service already assigned to this user")
    
    special_doc = {
        'userId': user_obj_id,
        'serviceId': service_obj_id,
        'customRate': data.customRate,
        'minQty': data.minQty or service['minQty'],
        'maxQty': data.maxQty or service['maxQty'],
        'status': data.status,
        'note': data.note,
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.user_special_services.insert_one(special_doc)
    
    return {
        'id': str(result.inserted_id),
        'serviceId': data.serviceId,
        'serviceName': service['name'],
        'customRate': data.customRate
    }

@router.put("/admin/users/{user_id}/special-services/{special_id}")
async def admin_update_user_special_service(request: Request, user_id: str, special_id: str):
    """Update special service assignment (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        special_obj_id = ObjectId(special_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid special service ID")
    
    body = await request.json()
    
    update_data = {}
    for key in ['customRate', 'minQty', 'maxQty', 'status', 'note']:
        if key in body:
            update_data[key] = body[key]
    
    if update_data:
        await db.user_special_services.update_one({'_id': special_obj_id}, {'$set': update_data})
    
    return {'message': 'Special service updated'}

@router.delete("/admin/users/{user_id}/special-services/{special_id}")
async def admin_delete_user_special_service(request: Request, user_id: str, special_id: str):
    """Remove special service from user (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        special_obj_id = ObjectId(special_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid special service ID")
    
    result = await db.user_special_services.delete_one({'_id': special_obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special service not found")
    
    return {'message': 'Special service removed'}
