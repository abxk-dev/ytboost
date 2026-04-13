"""
Users Routes - Admin user management
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from typing import Optional
from datetime import date
import uuid
import csv
import io

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

class BulkBalanceUpdate(BaseModel):
    emails: list[str] = []
    amount: float = Field(..., gt=0)
    note: str = ""

class NotifyUserRequest(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    message: str = Field(..., min_length=1, max_length=2000)
    type: str = Field("info", pattern="^(info|warning|success)$")

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
async def admin_get_users(
    request: Request,
    page: int = 1,
    limit: int = 50,
    search: str = None,
    status: str = None,
    balance: str = None,
    from_: str = None,
    to: str = None
):
    """Get all users (admin)"""
    from backend.middleware.admin import get_current_admin
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

    if balance:
        if balance == 'zero':
            query['balance'] = 0
        elif balance == 'under10':
            query['balance'] = {'$lt': 10}
        elif balance == 'over10':
            query['balance'] = {'$gt': 10}

    if from_ or to:
        created = {}
        try:
            if from_:
                created['$gte'] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            if to:
                created['$lte'] = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        if created:
            query['createdAt'] = created
    
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

@router.post("/admin/users/bulk-balance")
async def admin_bulk_add_balance(request: Request, data: BulkBalanceUpdate):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    query = {'role': {'$ne': 'admin'}}
    if data.emails:
        query['email'] = {'$in': [e.strip().lower() for e in data.emails if e.strip()]}

    users = await db.users.find(query).to_list(10000)
    if not users:
        raise HTTPException(status_code=400, detail="No users matched")

    updated = 0
    for u in users:
        current = float(u.get('balance', 0))
        new_balance = current + float(data.amount)
        await db.users.update_one({'_id': u['_id']}, {'$set': {'balance': new_balance}})
        await db.transactions.insert_one({
            'userId': u['_id'],
            'type': 'credit',
            'amount': float(data.amount),
            'description': f'Admin credit: {data.note or "Bulk balance add"}',
            'balanceAfter': new_balance,
            'createdAt': datetime.now(timezone.utc)
        })
        await db.user_activity_logs.insert_one({
            'userId': u['_id'],
            'action': 'Funds Added',
            'details': f'Admin bulk credit: {float(data.amount):.2f}',
            'createdAt': datetime.now(timezone.utc)
        })
        if socket_manager:
            await socket_manager.emit('balance_updated', {'balance': new_balance}, room=f'user-{str(u["_id"])}')
        updated += 1

    await log_admin_action(db, request, admin, "USER_BULK_BALANCE_ADD", f"Users: {updated}, Amount: {float(data.amount):.2f}")
    return {'message': 'Balance added', 'updated': updated, 'amount': float(data.amount)}

@router.get("/admin/users/{user_id}/activity")
async def admin_get_user_activity(request: Request, user_id: str, action: str = None):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    query = {'userId': obj_id}
    if action:
        query['action'] = action
    logs = await db.user_activity_logs.find(query).sort('createdAt', -1).limit(20).to_list(20)
    return [
        {
            'id': str(l['_id']),
            'action': l.get('action', ''),
            'details': l.get('details', ''),
            'createdAt': l.get('createdAt')
        }
        for l in logs
    ]

@router.post("/admin/users/{user_id}/notify")
async def admin_notify_user(request: Request, user_id: str, data: NotifyUserRequest):
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await db.users.find_one({'_id': obj_id})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    await db.notifications.insert_one({
        'userId': obj_id,
        'title': data.title,
        'message': data.message,
        'type': data.type,
        'read': False,
        'createdAt': datetime.now(timezone.utc)
    })
    await log_admin_action(db, request, admin, "USER_NOTIFY", f"User: {user.get('email','')}, Title: {data.title}")
    return {'message': 'Notification sent'}

@router.get("/admin/users/{user_id}/report")
async def admin_user_report(request: Request, user_id: str):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    try:
        obj_id = ObjectId(user_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid user ID")
    user = await db.users.find_one({'_id': obj_id}, {'password': 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    total_orders = await db.orders.count_documents({'userId': obj_id})
    spent_agg = await db.orders.aggregate([
        {'$match': {'userId': obj_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$charge'}}}
    ]).to_list(1)
    total_spent = float(spent_agg[0]['total']) if spent_agg else 0.0
    avg_value = (total_spent / total_orders) if total_orders else 0.0

    most = await db.orders.aggregate([
        {'$match': {'userId': obj_id}},
        {'$group': {'_id': '$serviceId', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 1}
    ]).to_list(1)
    most_service_name = ''
    if most:
        svc = await db.services.find_one({'_id': most[0]['_id']})
        most_service_name = svc['name'] if svc else 'Unknown'

    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    orders_this_month = await db.orders.count_documents({'userId': obj_id, 'createdAt': {'$gte': month_start}})

    txs = await db.transactions.find({'userId': obj_id}).sort('createdAt', -1).limit(50).to_list(50)
    balance_history = [
        {'createdAt': tx['createdAt'], 'balanceAfter': tx.get('balanceAfter', 0)}
        for tx in reversed(txs)
    ]

    return {
        'totalSpent': round(total_spent, 2),
        'totalOrders': total_orders,
        'mostOrderedService': most_service_name,
        'averageOrderValue': round(avg_value, 2),
        'ordersThisMonth': orders_this_month,
        'balanceHistory': balance_history,
        'currentBalance': user.get('balance', 0),
    }

@router.get("/user/notifications")
async def user_get_notifications(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    notes = await db.notifications.find({'userId': user_id}).sort('createdAt', -1).limit(50).to_list(50)
    unread = await db.notifications.count_documents({'userId': user_id, 'read': False})
    return {
        'unread': unread,
        'notifications': [
            {
                'id': str(n['_id']),
                'title': n.get('title', ''),
                'message': n.get('message', ''),
                'type': n.get('type', 'info'),
                'read': n.get('read', False),
                'createdAt': n.get('createdAt')
            } for n in notes
        ]
    }

@router.put("/user/notifications/{notification_id}/read")
async def user_mark_notification_read(request: Request, notification_id: str):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    try:
        obj_id = ObjectId(notification_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid notification ID")
    await db.notifications.update_one({'_id': obj_id, 'userId': user_id}, {'$set': {'read': True}})
    return {'message': 'Marked read'}

@router.put("/user/notifications/read-all")
async def user_mark_all_read(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    await db.notifications.update_many({'userId': user_id, 'read': False}, {'$set': {'read': True}})
    return {'message': 'All marked read'}

@router.get("/user/referral")
async def user_referral(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])

    referral_code = user.get('referralCode')
    if not referral_code:
        referral_code = uuid.uuid4().hex[:8].upper()
        await db.users.update_one({'_id': user_id}, {'$set': {'referralCode': referral_code}})

    total_referrals = await db.users.count_documents({'referredBy': user_id})
    referred = await db.users.find({'referredBy': user_id}, {'name': 1, 'createdAt': 1}).sort('createdAt', -1).limit(50).to_list(50)
    referred_users = []
    for u in referred:
        name = u.get('name', 'User')
        masked = name[:1] + '*' * max(0, len(name) - 1)
        referred_users.append({'name': masked, 'date': u.get('createdAt')})

    referral_earnings = float(user.get('referralEarnings', 0) or 0)
    link = f"/register?ref={referral_code}"

    return {
        'referralCode': referral_code,
        'referralLink': link,
        'totalReferrals': total_referrals,
        'totalEarned': round(referral_earnings, 2),
        'referredUsers': referred_users
    }

@router.get("/admin/users/{user_id}")
async def admin_get_user(request: Request, user_id: str):
    """Get single user details (admin)"""
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
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
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        special_obj_id = ObjectId(special_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid special service ID")
    
    result = await db.user_special_services.delete_one({'_id': special_obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Special service not found")
    
    return {'message': 'Special service removed'}

def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

@router.post("/user/api-key/regenerate")
async def user_regenerate_api_key(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])
    new_key = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    await db.users.update_one(
        {"_id": user_id},
        {"$set": {"apiKey": new_key, "apiKeyCreatedAt": now, "apiKeyLastUsedAt": None}}
    )
    return {"apiKey": new_key, "apiKeyCreatedAt": now, "apiKeyLastUsedAt": None}

@router.get("/user/api-stats")
async def user_api_stats(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])

    now = datetime.now(timezone.utc)
    start = _day_start(now)
    key_created = user.get("apiKeyCreatedAt") or user.get("createdAt")
    key_last_used = user.get("apiKeyLastUsedAt")

    total_calls = await db.api_call_logs.count_documents({"userId": user_id})
    calls_today = await db.api_call_logs.count_documents({"userId": user_id, "createdAt": {"$gte": start}})

    orders_via_api = await db.orders.count_documents({"userId": user_id, "viaApi": True})
    revenue_agg = await db.orders.aggregate([
        {"$match": {"userId": user_id, "viaApi": True}},
        {"$group": {"_id": None, "total": {"$sum": "$charge"}}}
    ]).to_list(1)
    revenue_via_api = float(revenue_agg[0]["total"]) if revenue_agg else 0.0

    since = now - timedelta(days=29)
    calls_agg = await db.api_call_logs.aggregate([
        {"$match": {"userId": user_id, "createdAt": {"$gte": since}}},
        {"$group": {"_id": {"$dateToString": {"format": "%Y-%m-%d", "date": "$createdAt"}}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}}
    ]).to_list(100)
    calls_per_day = [{"date": a["_id"], "count": a["count"]} for a in calls_agg]

    logs = await db.api_call_logs.find({"userId": user_id}).sort("createdAt", -1).limit(200).to_list(200)
    service_ids = []
    for l in logs:
        rb = l.get("requestBody") or {}
        sid = rb.get("service")
        try:
            service_ids.append(ObjectId(str(sid)))
        except Exception:
            continue
    service_ids = list({s for s in service_ids})
    services = await db.services.find({"_id": {"$in": service_ids}}, {"name": 1}).to_list(len(service_ids) or 1)
    svc_name = {s["_id"]: s.get("name", "") for s in services}

    table = []
    for l in logs[:100]:
        rb = l.get("requestBody") or {}
        sid_raw = rb.get("service")
        sid = None
        try:
            sid = ObjectId(str(sid_raw))
        except Exception:
            sid = None
        table.append({
            "id": str(l.get("_id")),
            "createdAt": l.get("createdAt"),
            "action": l.get("action", ""),
            "service": svc_name.get(sid, "") if sid else "",
            "status": "OK" if int(l.get("responseStatus", 200)) < 400 else "Error",
            "responseTime": int(l.get("responseTime", 0) or 0),
        })

    return {
        "apiKey": user.get("apiKey", ""),
        "apiKeyMasked": "sk-" + (str(user.get("apiKey", ""))[:4] + "..." + str(user.get("apiKey", ""))[-4:] if user.get("apiKey") else ""),
        "apiKeyCreatedAt": key_created,
        "apiKeyLastUsedAt": key_last_used,
        "totalCalls": total_calls,
        "callsToday": calls_today,
        "ordersViaApi": orders_via_api,
        "revenueViaApi": round(revenue_via_api, 2),
        "callsPerDay": calls_per_day,
        "logs": table,
    }

@router.get("/user/price-list/csv")
async def user_price_list_csv(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])

    services = await db.services.find({"status": True}).to_list(10000)
    cat_ids = list({s.get("categoryId") for s in services if s.get("categoryId")})
    cats = await db.categories.find({"_id": {"$in": cat_ids}}, {"name": 1, "order": 1, "createdAt": 1}).to_list(len(cat_ids) or 1)
    cat_map = {c["_id"]: c for c in cats}

    special = await db.user_special_services.find({"userId": user_id, "status": True}).to_list(10000)
    special_map = {ss["serviceId"]: ss for ss in special if ss.get("serviceId")}

    rows = []
    for svc in services:
        ss = special_map.get(svc["_id"])
        rate = float(ss.get("customRate")) if ss else float(svc.get("rate", 0) or 0)
        min_qty = int(ss.get("minQty", svc.get("minQty", 0))) if ss else int(svc.get("minQty", 0))
        max_qty = int(ss.get("maxQty", svc.get("maxQty", 0))) if ss else int(svc.get("maxQty", 0))
        cat = cat_map.get(svc.get("categoryId")) or {}
        rows.append({
            "ID": str(svc["_id"]),
            "Name": svc.get("name", ""),
            "Category": cat.get("name", "Unknown"),
            "Rate": rate,
            "Min": min_qty,
            "Max": max_qty,
            "Type": svc.get("type", "Default"),
            "_catOrder": int(cat.get("order") or 0),
        })
    rows.sort(key=lambda r: (r["_catOrder"], r["Category"], r["Name"]))

    buf = io.StringIO()
    writer = csv.DictWriter(buf, fieldnames=["ID", "Name", "Category", "Rate", "Min", "Max", "Type"])
    writer.writeheader()
    for r in rows:
        writer.writerow({k: r[k] for k in ["ID", "Name", "Category", "Rate", "Min", "Max", "Type"]})
    content = buf.getvalue().encode("utf-8")

    from fastapi.responses import Response
    return Response(
        content=content,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="ytboost-price-list-{user.get("email","user")}.csv"'}
    )

@router.get("/user/price-list/pdf")
async def user_price_list_pdf(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])

    services = await db.services.find({"status": True}).to_list(10000)
    cat_ids = list({s.get("categoryId") for s in services if s.get("categoryId")})
    cats = await db.categories.find({"_id": {"$in": cat_ids}}, {"name": 1, "order": 1, "createdAt": 1}).to_list(len(cat_ids) or 1)
    cat_map = {c["_id"]: c for c in cats}

    special = await db.user_special_services.find({"userId": user_id, "status": True}).to_list(10000)
    special_map = {ss["serviceId"]: ss for ss in special if ss.get("serviceId")}

    rows = []
    for svc in services:
        ss = special_map.get(svc["_id"])
        rate = float(ss.get("customRate")) if ss else float(svc.get("rate", 0) or 0)
        min_qty = int(ss.get("minQty", svc.get("minQty", 0))) if ss else int(svc.get("minQty", 0))
        max_qty = int(ss.get("maxQty", svc.get("maxQty", 0))) if ss else int(svc.get("maxQty", 0))
        cat = cat_map.get(svc.get("categoryId")) or {}
        rows.append([
            str(svc["_id"])[-6:],
            svc.get("name", ""),
            cat.get("name", "Unknown"),
            f"${rate:.4f}",
            str(min_qty),
            str(max_qty),
            svc.get("type", "Default"),
            int(cat.get("order") or 0),
        ])
    rows.sort(key=lambda r: (r[7], r[2], r[1]))

    try:
        from reportlab.lib.pagesizes import letter
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, Image
        from reportlab.lib.styles import getSampleStyleSheet
        from reportlab.lib import colors
    except Exception:
        raise HTTPException(status_code=500, detail="PDF generator not installed")

    pdf_buf = io.BytesIO()
    doc = SimpleDocTemplate(pdf_buf, pagesize=letter, leftMargin=36, rightMargin=36, topMargin=36, bottomMargin=36)
    styles = getSampleStyleSheet()
    story = []

    title = Paragraph("YTBoost.io — My Price List", styles["Title"])
    story.append(title)
    story.append(Spacer(1, 8))
    meta = Paragraph(f'User: {user.get("name","")} ({user.get("email","")})<br/>Date: {datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M UTC")}', styles["Normal"])
    story.append(meta)
    story.append(Spacer(1, 10))

    data = [["ID", "Name", "Category", "Rate", "Min", "Max", "Type"]]
    for r in rows:
        data.append(r[:7])

    table = Table(data, repeatRows=1, colWidths=[40, 210, 95, 55, 40, 40, 60])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#7c3aed")),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, 0), 10),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.lightgrey),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.whitesmoke, colors.white]),
        ("FONTSIZE", (0, 1), (-1, -1), 8),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(table)
    story.append(Spacer(1, 10))
    story.append(Paragraph("Note: Rates may vary by service type. Special rates are applied automatically.", styles["Italic"]))

    doc.build(story)
    pdf_bytes = pdf_buf.getvalue()

    from fastapi.responses import Response
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="ytboost-price-list-{user.get("email","user")}.pdf"'}
    )

@router.get("/user/analytics/overview")
async def user_analytics_overview(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])
    now = datetime.now(timezone.utc)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)

    total_orders = await db.orders.count_documents({"userId": user_id})
    total_spent_agg = await db.orders.aggregate([
        {"$match": {"userId": user_id}},
        {"$group": {"_id": None, "total": {"$sum": "$charge"}}}
    ]).to_list(1)
    total_spent = float(total_spent_agg[0]["total"]) if total_spent_agg else 0.0

    month_spent_agg = await db.orders.aggregate([
        {"$match": {"userId": user_id, "createdAt": {"$gte": month_start}}},
        {"$group": {"_id": None, "total": {"$sum": "$charge"}}}
    ]).to_list(1)
    spent_this_month = float(month_spent_agg[0]["total"]) if month_spent_agg else 0.0

    since = now - timedelta(days=29)
    last30_agg = await db.orders.aggregate([
        {"$match": {"userId": user_id, "createdAt": {"$gte": since}}},
        {"$group": {"_id": None, "total": {"$sum": "$charge"}}}
    ]).to_list(1)
    last30_total = float(last30_agg[0]["total"]) if last30_agg else 0.0
    avg_daily = last30_total / 30.0

    recent_orders = await db.orders.find({"userId": user_id}).sort("createdAt", -1).limit(10).to_list(10)
    svc_ids = list({o.get("serviceId") for o in recent_orders if o.get("serviceId")})
    svcs = await db.services.find({"_id": {"$in": svc_ids}}, {"name": 1}).to_list(len(svc_ids) or 1)
    svc_map = {s["_id"]: s.get("name", "") for s in svcs}
    recent = [
        {
            "id": str(o["_id"]),
            "serviceName": svc_map.get(o.get("serviceId"), "Unknown"),
            "charge": float(o.get("charge", 0) or 0),
            "quantity": int(o.get("quantity", 0) or 0),
            "status": o.get("status", ""),
            "createdAt": o.get("createdAt"),
        }
        for o in recent_orders
    ]

    return {
        "totalSpent": round(total_spent, 2),
        "spentThisMonth": round(spent_this_month, 2),
        "avgDailySpend": round(avg_daily, 2),
        "totalOrders": total_orders,
        "recentOrders": recent,
    }

@router.get("/user/analytics/top-services")
async def user_analytics_top_services(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])
    agg = await db.orders.aggregate([
        {"$match": {"userId": user_id}},
        {"$group": {"_id": "$serviceId", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 5},
    ]).to_list(5)
    svc_ids = [a["_id"] for a in agg if a.get("_id")]
    svcs = await db.services.find({"_id": {"$in": svc_ids}}, {"name": 1}).to_list(len(svc_ids) or 1)
    svc_map = {s["_id"]: s.get("name", "") for s in svcs}
    return [{"serviceId": str(a["_id"]), "serviceName": svc_map.get(a["_id"], "Unknown"), "count": a["count"]} for a in agg]

@router.get("/user/analytics/spending")
async def user_analytics_spending(request: Request, period: str = "daily"):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user["_id"])
    now = datetime.now(timezone.utc)

    period = period if period in {"daily", "weekly", "monthly"} else "daily"
    if period == "daily":
        start = _day_start(now) - timedelta(days=29)
    elif period == "weekly":
        start = _day_start(now) - timedelta(days=7 * 11)
    else:
        start = _day_start(now) - timedelta(days=365)

    orders = await db.orders.find({"userId": user_id, "createdAt": {"$gte": start}}, {"charge": 1, "createdAt": 1}).to_list(50000)

    buckets = {}
    for o in orders:
        dt = o.get("createdAt")
        if not dt:
            continue
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        if period == "daily":
            key = dt.strftime("%Y-%m-%d")
        elif period == "weekly":
            iso_year, iso_week, _ = dt.isocalendar()
            key = f"{iso_year}-W{iso_week:02d}"
        else:
            key = dt.strftime("%Y-%m")
        buckets[key] = buckets.get(key, 0.0) + float(o.get("charge", 0) or 0)

    points = [{"date": k, "amount": round(v, 2)} for k, v in sorted(buckets.items(), key=lambda x: x[0])]
    return {"period": period, "points": points}
