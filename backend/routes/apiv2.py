"""
API v2 Routes - Reseller API
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from datetime import datetime, timezone
from bson import ObjectId
import re

router = APIRouter(tags=["API v2"])

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def validate_youtube_url(url: str) -> bool:
    """Validate YouTube URL"""
    youtube_pattern = r'(youtube\.com|youtu\.be)'
    return bool(re.search(youtube_pattern, url, re.IGNORECASE))

@router.post("/v2")
async def api_v2_handler(request: Request):
    """
    Reseller API v2 endpoint
    
    Actions:
    - services: List all services
    - add: Create new order
    - status: Get order status
    - balance: Get account balance
    """
    try:
        body = await request.json()
    except:
        raise HTTPException(status_code=400, detail="Invalid JSON")
    
    action = body.get('action')
    key = body.get('key')
    
    if action == 'services':
        # Public action - no key required
        services = await db.services.find({'status': True}).to_list(1000)
        result = []
        for svc in services:
            cat = await db.categories.find_one({'_id': svc['categoryId']})
            result.append({
                'service': str(svc['_id']),
                'name': svc['name'],
                'category': cat['name'] if cat else 'Unknown',
                'rate': svc['rate'],
                'min': svc['minQty'],
                'max': svc['maxQty'],
                'type': svc.get('type', 'Default')
            })
        return result
    
    # All other actions require API key
    if not key:
        raise HTTPException(status_code=400, detail="API key required")
    
    # Verify API key
    user = await db.users.find_one({'apiKey': key, 'status': 'active'})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid API key")
    
    user_id = user['_id']
    
    if action == 'balance':
        return {
            'balance': user.get('balance', 0),
            'currency': 'USD'
        }
    
    elif action == 'add':
        service_id = body.get('service')
        link = body.get('link')
        quantity = body.get('quantity')
        
        if not all([service_id, link, quantity]):
            raise HTTPException(status_code=400, detail="Missing parameters: service, link, quantity required")
        
        try:
            quantity = int(quantity)
        except:
            raise HTTPException(status_code=400, detail="Invalid quantity")
        
        if not validate_youtube_url(link):
            raise HTTPException(status_code=400, detail="Invalid YouTube URL")
        
        try:
            svc_obj_id = ObjectId(service_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid service ID")
        
        service = await db.services.find_one({'_id': svc_obj_id, 'status': True})
        if not service:
            raise HTTPException(status_code=404, detail="Service not found")
        
        # Check quantity limits
        if quantity < service['minQty'] or quantity > service['maxQty']:
            raise HTTPException(status_code=400, detail=f"Quantity must be between {service['minQty']} and {service['maxQty']}")
        
        # Calculate charge
        charge = (quantity / 1000) * service['rate']
        
        # Check balance
        if user.get('balance', 0) < charge:
            raise HTTPException(status_code=400, detail="Insufficient balance")
        
        # Deduct balance
        new_balance = user['balance'] - charge
        await db.users.update_one({'_id': user_id}, {'$set': {'balance': new_balance}})
        
        # Create order
        order_doc = {
            'userId': user_id,
            'serviceId': svc_obj_id,
            'link': link,
            'quantity': quantity,
            'charge': round(charge, 4),
            'status': 'Pending',
            'startCount': 0,
            'remains': quantity,
            'createdAt': datetime.now(timezone.utc)
        }
        
        result = await db.orders.insert_one(order_doc)
        
        # Create transaction
        await db.transactions.insert_one({
            'userId': user_id,
            'type': 'debit',
            'amount': charge,
            'description': f'API Order #{str(result.inserted_id)[-8:]}',
            'balanceAfter': new_balance,
            'createdAt': datetime.now(timezone.utc)
        })
        
        return {
            'order': str(result.inserted_id)
        }
    
    elif action == 'status':
        order_id = body.get('order')
        
        if not order_id:
            raise HTTPException(status_code=400, detail="Order ID required")
        
        try:
            order_obj_id = ObjectId(order_id)
        except:
            raise HTTPException(status_code=400, detail="Invalid order ID")
        
        order = await db.orders.find_one({'_id': order_obj_id, 'userId': user_id})
        if not order:
            raise HTTPException(status_code=404, detail="Order not found")
        
        return {
            'charge': order['charge'],
            'start_count': order.get('startCount', 0),
            'status': order['status'],
            'remains': order.get('remains', 0),
            'currency': 'USD'
        }
    
    else:
        raise HTTPException(status_code=400, detail=f"Unknown action: {action}")
