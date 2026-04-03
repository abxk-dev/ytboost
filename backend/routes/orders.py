"""
Orders Routes - Order management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
from typing import Optional
import re

router = APIRouter(tags=["Orders"])

# Request models
class OrderCreate(BaseModel):
    serviceId: str
    link: str = Field(..., min_length=1)
    quantity: int = Field(..., gt=0)
    customData: Optional[str] = None
    duration: Optional[str] = None

class OrderStatusUpdate(BaseModel):
    status: str = Field(..., pattern="^(Pending|Processing|In Progress|Completed|Partial|Cancelled)$")
    startCount: Optional[int] = None
    remains: Optional[int] = None

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def validate_youtube_url(url: str) -> bool:
    """Validate YouTube URL"""
    youtube_pattern = r'(youtube\.com|youtu\.be)'
    return bool(re.search(youtube_pattern, url, re.IGNORECASE))

# User routes
@router.post("/orders")
async def create_order(request: Request, data: OrderCreate):
    """Create new order (authenticated user)"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    # Validate YouTube URL
    if not validate_youtube_url(data.link):
        raise HTTPException(status_code=400, detail="Invalid YouTube URL")
    
    try:
        service_id = ObjectId(data.serviceId)
    except:
        raise HTTPException(status_code=400, detail="Invalid service ID")
    
    # Get service
    service = await db.services.find_one({'_id': service_id, 'status': True})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check if user has special rate for this service
    special = await db.user_special_services.find_one({
        'userId': user_id,
        'serviceId': service_id,
        'status': True
    })
    
    if special:
        rate = special['customRate']
        min_qty = special.get('minQty', service['minQty'])
        max_qty = special.get('maxQty', service['maxQty'])
    else:
        rate = service['rate']
        min_qty = service['minQty']
        max_qty = service['maxQty']
    
    # Validate quantity
    if data.quantity < min_qty or data.quantity > max_qty:
        raise HTTPException(status_code=400, detail=f"Quantity must be between {min_qty} and {max_qty}")
    
    # Calculate charge based on service type
    svc_type = service.get('type', 'Default')
    
    if svc_type == 'Package':
        charge = service.get('packagePrice', rate)
    elif svc_type == 'Subscription' and data.duration:
        multiplier = {'7d': 1.0, '14d': 1.8, '30d': 3.0}.get(data.duration, 1.0)
        charge = ((data.quantity / 1000) * rate) * multiplier
    else:
        charge = (data.quantity / 1000) * rate
    
    # Get current user balance
    user_doc = await db.users.find_one({'_id': user_id})
    current_balance = user_doc.get('balance', 0)
    
    if current_balance < charge:
        raise HTTPException(status_code=400, detail="Insufficient balance. Please add funds.")
    
    # Deduct balance
    new_balance = current_balance - charge
    await db.users.update_one({'_id': user_id}, {'$set': {'balance': new_balance}})
    
    # Create order
    order_doc = {
        'userId': user_id,
        'serviceId': service_id,
        'serviceType': service.get('type', 'Default'),
        'link': data.link,
        'quantity': data.quantity,
        'charge': round(charge, 4),
        'status': 'Pending',
        'startCount': 0,
        'remains': data.quantity,
        'customData': data.customData or '',
        'duration': data.duration or '',
        'refillHistory': [],
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.orders.insert_one(order_doc)
    
    # Create debit transaction
    await db.transactions.insert_one({
        'userId': user_id,
        'type': 'debit',
        'amount': charge,
        'description': f'Order #{str(result.inserted_id)[-8:]} - {service["name"]}',
        'balanceAfter': new_balance,
        'createdAt': datetime.now(timezone.utc)
    })
    
    return {
        'id': str(result.inserted_id),
        'serviceId': str(service_id),
        'serviceName': service['name'],
        'link': data.link,
        'quantity': data.quantity,
        'charge': round(charge, 4),
        'status': 'Pending',
        'newBalance': new_balance
    }

@router.get("/orders")
async def get_user_orders(request: Request, page: int = 1, limit: int = 20, status: str = None, search: str = None):
    """Get user's orders (authenticated)"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    # Build query
    query = {'userId': user_id}
    if status:
        query['status'] = status
    if search:
        query['$or'] = [
            {'link': {'$regex': search, '$options': 'i'}}
        ]
    
    # Get total count
    total = await db.orders.count_documents(query)
    
    # Get paginated orders
    skip = (page - 1) * limit
    orders = await db.orders.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for order in orders:
        service = await db.services.find_one({'_id': order['serviceId']})
        result.append({
            'id': str(order['_id']),
            'serviceId': str(order['serviceId']),
            'serviceName': service['name'] if service else 'Unknown',
            'serviceType': order.get('serviceType', service.get('type', 'Default') if service else 'Default'),
            'link': order['link'],
            'quantity': order['quantity'],
            'charge': order['charge'],
            'status': order['status'],
            'startCount': order.get('startCount', 0),
            'remains': order.get('remains', 0),
            'customData': order.get('customData', ''),
            'duration': order.get('duration', ''),
            'refillEnabled': service.get('refillEnabled', False) if service else False,
            'refillHistory': order.get('refillHistory', []),
            'createdAt': order['createdAt']
        })
    
    return {
        'orders': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.post("/orders/{order_id}/refill")
async def request_refill(request: Request, order_id: str):
    """Request a refill for a completed order"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    try:
        obj_id = ObjectId(order_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    
    order = await db.orders.find_one({'_id': obj_id, 'userId': user_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    if order['status'] != 'Completed':
        raise HTTPException(status_code=400, detail="Only completed orders can be refilled")
    
    # Check if service has refill enabled
    service = await db.services.find_one({'_id': order['serviceId']})
    if not service or not service.get('refillEnabled', False):
        raise HTTPException(status_code=400, detail="Refill is not available for this service")
    
    # Add refill record
    refill_record = {
        'requestedAt': datetime.now(timezone.utc).isoformat(),
        'status': 'Requested'
    }
    
    await db.orders.update_one(
        {'_id': obj_id},
        {'$push': {'refillHistory': refill_record}}
    )
    
    return {'message': 'Refill requested successfully'}

@router.get("/orders/{order_id}")
async def get_order(request: Request, order_id: str):
    """Get single order details (authenticated)"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    
    try:
        obj_id = ObjectId(order_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    
    order = await db.orders.find_one({'_id': obj_id, 'userId': ObjectId(user['_id'])})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    service = await db.services.find_one({'_id': order['serviceId']})
    
    return {
        'id': str(order['_id']),
        'serviceId': str(order['serviceId']),
        'serviceName': service['name'] if service else 'Unknown',
        'link': order['link'],
        'quantity': order['quantity'],
        'charge': order['charge'],
        'status': order['status'],
        'startCount': order.get('startCount', 0),
        'remains': order.get('remains', 0),
        'createdAt': order['createdAt']
    }

# Admin routes
@router.get("/admin/orders")
async def admin_get_orders(request: Request, page: int = 1, limit: int = 50, status: str = None, userId: str = None):
    """Get all orders (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Build query
    query = {}
    if status:
        query['status'] = status
    if userId:
        try:
            query['userId'] = ObjectId(userId)
        except:
            pass
    
    # Get total count
    total = await db.orders.count_documents(query)
    
    # Get paginated orders
    skip = (page - 1) * limit
    orders = await db.orders.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for order in orders:
        service = await db.services.find_one({'_id': order['serviceId']})
        user = await db.users.find_one({'_id': order['userId']})
        result.append({
            'id': str(order['_id']),
            'userId': str(order['userId']),
            'userName': user['name'] if user else 'Unknown',
            'userEmail': user['email'] if user else 'Unknown',
            'serviceId': str(order['serviceId']),
            'serviceName': service['name'] if service else 'Unknown',
            'serviceType': order.get('serviceType', service.get('type', 'Default') if service else 'Default'),
            'link': order['link'],
            'quantity': order['quantity'],
            'charge': order['charge'],
            'status': order['status'],
            'startCount': order.get('startCount', 0),
            'remains': order.get('remains', 0),
            'customData': order.get('customData', ''),
            'duration': order.get('duration', ''),
            'refillHistory': order.get('refillHistory', []),
            'createdAt': order['createdAt']
        })
    
    return {
        'orders': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.put("/admin/orders/{order_id}/status")
async def admin_update_order_status(request: Request, order_id: str, data: OrderStatusUpdate):
    """Update order status (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(order_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    
    order = await db.orders.find_one({'_id': obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    update_data = {'status': data.status}
    if data.startCount is not None:
        update_data['startCount'] = data.startCount
    if data.remains is not None:
        update_data['remains'] = data.remains
    
    await db.orders.update_one({'_id': obj_id}, {'$set': update_data})
    
    return {'message': 'Order status updated', 'status': data.status}
