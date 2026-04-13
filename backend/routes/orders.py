"""
Orders Routes - Order management
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
import logging

logger = logging.getLogger(__name__)
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
    status: str = Field(..., pattern="^(Pending|Processing|In Progress|Completed|Partial|Cancelled|Failed)$")
    startCount: Optional[int] = None
    remains: Optional[int] = None

class BulkOrderAction(BaseModel):
    orderIds: list[str] = []
    action: str = Field(..., pattern="^(complete|cancel|processing|resend)$")

class OrderNoteUpdate(BaseModel):
    note: str = ""

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
    from backend.middleware.auth import get_current_user
    
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
    fulfillment = service.get('fulfillmentType', 'manual')
    provider_name = ''
    provider_order_id = ''
    provider_error = ''
    provider_http_status = None
    provider_response = ''
    provider_last_attempt_at = None
    
    if fulfillment == 'auto' and service.get('providerId'):
        provider = await db.api_providers.find_one({'_id': service['providerId']})
        if provider:
            provider_name = provider['name']
            # Auto-send to provider
            try:
                import httpx
                async with httpx.AsyncClient(timeout=15) as client_http:
                    provider_last_attempt_at = datetime.now(timezone.utc)
                    resp = await client_http.post((provider.get('apiUrl') or '').strip(), data={
                        'key': provider['apiKey'],
                        'action': 'add',
                        'service': service.get('providerServiceId', ''),
                        'link': data.link,
                        'quantity': data.quantity,
                    })
                    provider_http_status = resp.status_code
                    raw_text = resp.text
                    provider_response = raw_text[:2000] if isinstance(raw_text, str) else ''
                    try:
                        result = resp.json()
                    except Exception:
                        result = None

                    if isinstance(result, dict) and 'order' in result:
                        provider_order_id = str(result['order'])
                    elif isinstance(result, dict):
                        provider_error = str(result.get('error') or result.get('message') or result)
                    else:
                        provider_error = provider_response or f"Provider returned HTTP {provider_http_status}"
            except Exception as e:
                provider_last_attempt_at = datetime.now(timezone.utc)
                provider_error = str(e)
                logger.error(f"Auto-fulfillment failed: {e}")
        else:
            provider_error = "Provider not found or disabled"
    elif fulfillment == 'auto':
        provider_error = "Service is set to auto fulfillment but provider is not configured"

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
        'fulfillmentType': fulfillment,
        'providerName': provider_name,
        'providerOrderId': provider_order_id,
        'providerError': provider_error,
        'providerHttpStatus': provider_http_status,
        'providerResponse': provider_response,
        'providerLastAttemptAt': provider_last_attempt_at,
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
    from backend.middleware.auth import get_current_user
    
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
            'fulfillmentType': order.get('fulfillmentType', 'manual'),
            'providerName': order.get('providerName', ''),
            'providerOrderId': order.get('providerOrderId', ''),
            'providerError': order.get('providerError', ''),
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
    from backend.middleware.auth import get_current_user
    
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
    from backend.middleware.auth import get_current_user
    
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
async def admin_get_orders(request: Request, page: int = 1, limit: int = 50, status: str = None, userId: str = None, search: str = None):
    """Get all orders (admin)"""
    from backend.middleware.admin import get_current_admin
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
    if search:
        query['$or'] = [{'link': {'$regex': search, '$options': 'i'}}]
    
    # Get total count
    total = await db.orders.count_documents(query)
    
    # Get paginated orders
    skip = (page - 1) * limit
    orders = await db.orders.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for order in orders:
        service = await db.services.find_one({'_id': order['serviceId']})
        user = await db.users.find_one({'_id': order['userId']})
        provider_error_computed = ''
        provider_name = order.get('providerName', '')
        provider_order_id = order.get('providerOrderId', '')
        provider_error = order.get('providerError', '')
        if order.get('fulfillmentType') == 'auto' and not provider_order_id and not provider_error:
            if not service:
                provider_error_computed = 'Service not found'
            else:
                provider_id = service.get('providerId')
                if not provider_id:
                    provider_error_computed = 'Provider not configured for this service'
                elif not service.get('providerServiceId'):
                    provider_error_computed = 'Provider Service ID missing'
                else:
                    provider = await db.api_providers.find_one({'_id': provider_id})
                    if not provider or not provider.get('status', True):
                        provider_error_computed = 'Provider not found or disabled'
                    elif not (provider.get('apiUrl') or '').strip() or not (provider.get('apiKey') or '').strip():
                        provider_error_computed = 'Provider API URL/Key missing'
                    else:
                        provider_error_computed = 'Order not sent to provider yet'
                    if provider and not provider_name:
                        provider_name = provider.get('name', '')
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
            'fulfillmentType': order.get('fulfillmentType', 'manual'),
            'providerName': provider_name,
            'providerOrderId': provider_order_id,
            'providerError': provider_error,
            'providerErrorComputed': provider_error_computed,
            'providerHttpStatus': order.get('providerHttpStatus'),
            'providerResponse': order.get('providerResponse', ''),
            'providerLastAttemptAt': order.get('providerLastAttemptAt'),
            'note': order.get('note', ''),
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
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    
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
    await log_admin_action(db, request, admin, "ORDER_STATUS_UPDATED", f"Order: {order_id}, Status: {data.status}")
    return {'message': 'Order status updated', 'status': data.status}

@router.post("/admin/orders/bulk-action")
async def admin_bulk_order_action(request: Request, data: BulkOrderAction):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})
    if not data.orderIds:
        raise HTTPException(status_code=400, detail="No orders selected")

    action_map = {
        'complete': 'Completed',
        'processing': 'Processing',
        'cancel': 'Cancelled',
    }

    updated = 0
    resend = 0

    import httpx
    for oid in data.orderIds:
        try:
            obj_id = ObjectId(oid)
        except Exception:
            continue
        order = await db.orders.find_one({'_id': obj_id})
        if not order:
            continue
        if data.action == 'resend':
            if order.get('fulfillmentType') != 'auto':
                continue
            service = await db.services.find_one({'_id': order['serviceId']})
            if not service or not service.get('providerId'):
                continue
            provider = await db.api_providers.find_one({'_id': service['providerId']})
            if not provider or not provider.get('status', True):
                continue
            try:
                async with httpx.AsyncClient(timeout=15) as client_http:
                    resp = await client_http.post(provider['apiUrl'], data={
                        'key': provider['apiKey'],
                        'action': 'add',
                        'service': service.get('providerServiceId', ''),
                        'link': order.get('link', ''),
                        'quantity': order.get('quantity', 0),
                    })
                    result = resp.json()
                new_provider_order_id = str(result.get('order', ''))
                if new_provider_order_id:
                    await db.orders.update_one(
                        {'_id': obj_id},
                        {'$set': {
                            'providerOrderId': new_provider_order_id,
                            'providerName': provider.get('name', ''),
                            'providerError': '',
                            'providerHttpStatus': resp.status_code,
                            'providerResponse': (resp.text or '')[:2000],
                            'providerLastAttemptAt': datetime.now(timezone.utc),
                        }}
                    )
                    resend += 1
                else:
                    await db.orders.update_one(
                        {'_id': obj_id},
                        {'$set': {
                            'providerError': str(result.get('error') or result.get('message') or result),
                            'providerHttpStatus': resp.status_code,
                            'providerResponse': (resp.text or '')[:2000],
                            'providerLastAttemptAt': datetime.now(timezone.utc),
                        }}
                    )
            except Exception:
                try:
                    await db.orders.update_one(
                        {'_id': obj_id},
                        {'$set': {
                            'providerError': 'Provider request failed',
                            'providerLastAttemptAt': datetime.now(timezone.utc),
                        }}
                    )
                except Exception:
                    pass
                continue
        else:
            new_status = action_map.get(data.action)
            if not new_status:
                continue
            await db.orders.update_one({'_id': obj_id}, {'$set': {'status': new_status}})
            updated += 1

    await log_admin_action(db, request, admin, "ORDER_BULK_ACTION", f"Action: {data.action}, Updated: {updated}, Resent: {resend}")
    return {'message': 'Bulk action applied', 'updated': updated, 'resent': resend}

@router.put("/admin/orders/{order_id}/note")
async def admin_update_order_note(request: Request, order_id: str, data: OrderNoteUpdate):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await db.orders.find_one({'_id': obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    await db.orders.update_one({'_id': obj_id}, {'$set': {'note': data.note}})
    await log_admin_action(db, request, admin, "ORDER_NOTE_UPDATED", f"Order: {order_id}")
    return {'message': 'Note saved'}

@router.post("/admin/orders/{order_id}/cancel-refund")
async def admin_cancel_refund(request: Request, order_id: str):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})
    try:
        obj_id = ObjectId(order_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order ID")
    order = await db.orders.find_one({'_id': obj_id})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    if order.get('refundedAt'):
        raise HTTPException(status_code=400, detail="Refund already issued")
    user = await db.users.find_one({'_id': order['userId']})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    refund_amount = float(order.get('charge', 0))
    new_balance = float(user.get('balance', 0)) + refund_amount
    await db.users.update_one({'_id': user['_id']}, {'$set': {'balance': new_balance}})
    await db.transactions.insert_one({
        'userId': user['_id'],
        'type': 'credit',
        'amount': refund_amount,
        'description': f"Refund for cancelled order #{str(order['_id'])}",
        'balanceAfter': new_balance,
        'createdAt': datetime.now(timezone.utc)
    })
    await db.orders.update_one(
        {'_id': obj_id},
        {'$set': {
            'status': 'Cancelled',
            'cancelledAt': datetime.now(timezone.utc),
            'refundedAt': datetime.now(timezone.utc),
            'refundAmount': refund_amount,
            'refundReason': 'Refund for cancelled order',
        }}
    )
    await db.notifications.insert_one({
        'userId': user['_id'],
        'title': 'Refund issued',
        'message': f'Your order was cancelled and ${refund_amount:.2f} was refunded to your balance.',
        'type': 'info',
        'read': False,
        'createdAt': datetime.now(timezone.utc)
    })
    await log_admin_action(db, request, admin, "ORDER_CANCEL_REFUND", f"Order: {order_id}, Amount: {refund_amount:.2f}")
    return {'message': 'Order cancelled and refunded', 'refundAmount': refund_amount, 'newBalance': new_balance}

@router.get("/admin/orders/export")
async def admin_export_orders(request: Request, status: str = None):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    query = {}
    if status:
        query['status'] = status
    orders = await db.orders.find(query).sort('createdAt', -1).to_list(50000)

    user_ids = list({o['userId'] for o in orders if o.get('userId')})
    svc_ids = list({o['serviceId'] for o in orders if o.get('serviceId')})
    users = await db.users.find({'_id': {'$in': user_ids}}, {'email': 1}).to_list(len(user_ids) or 1)
    services = await db.services.find({'_id': {'$in': svc_ids}}, {'name': 1}).to_list(len(svc_ids) or 1)
    user_email = {u['_id']: u.get('email', '') for u in users}
    service_name = {s['_id']: s.get('name', '') for s in services}

    def _iter_csv():
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'User Email', 'Service', 'Link', 'Quantity', 'Charge', 'Status', 'Created Date', 'Notes'])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for o in orders:
            writer.writerow([
                str(o['_id']),
                user_email.get(o.get('userId'), ''),
                service_name.get(o.get('serviceId'), ''),
                o.get('link', ''),
                o.get('quantity', 0),
                o.get('charge', 0),
                o.get('status', ''),
                o.get('createdAt').isoformat() if o.get('createdAt') else '',
                o.get('note', ''),
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"orders_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(_iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})

@router.get("/admin/finance/refunds")
async def admin_finance_refunds(request: Request, page: int = 1, limit: int = 50, from_: str = None, to: str = None):
    from backend.middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    query = {'refundedAt': {'$exists': True, '$ne': None}}
    if from_ or to:
        rng = {}
        try:
            if from_:
                rng['$gte'] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            if to:
                rng['$lte'] = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        if rng:
            query['refundedAt'] = rng

    total = await db.orders.count_documents(query)
    skip = (page - 1) * limit
    orders = await db.orders.find(query).sort('refundedAt', -1).skip(skip).limit(limit).to_list(limit)

    user_ids = list({o['userId'] for o in orders if o.get('userId')})
    users = await db.users.find({'_id': {'$in': user_ids}}, {'name': 1, 'email': 1}).to_list(len(user_ids) or 1)
    user_map = {u['_id']: u for u in users}

    result = []
    for o in orders:
        u = user_map.get(o.get('userId'))
        result.append({
            'orderId': str(o['_id']),
            'userName': u.get('name', 'Unknown') if u else 'Unknown',
            'userEmail': u.get('email', 'Unknown') if u else 'Unknown',
            'amountRefunded': float(o.get('refundAmount', 0) or 0),
            'refundedAt': o.get('refundedAt'),
            'reason': o.get('refundReason', 'Refund')
        })

    return {
        'refunds': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.get("/admin/finance/refunds/export")
async def admin_finance_refunds_export(request: Request, from_: str = None, to: str = None):
    data = await admin_finance_refunds(request, page=1, limit=50000, from_=from_, to=to)
    refunds = data.get('refunds', [])

    def _iter_csv():
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Order ID', 'User', 'Amount Refunded', 'Date', 'Reason'])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for r in refunds:
            writer.writerow([r['orderId'], r['userEmail'], r['amountRefunded'], r['refundedAt'].isoformat() if r.get('refundedAt') else '', r.get('reason', '')])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"refunds_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(_iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
