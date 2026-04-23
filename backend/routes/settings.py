"""
Settings Routes - Site settings management
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from datetime import datetime, timezone, timedelta
from bson import ObjectId
import os
import shutil
import uuid
from backend.middleware.admin import get_request_ip

router = APIRouter(tags=["Settings"])

UPLOAD_DIR = os.environ.get('UPLOAD_DIR', './uploads')

# Ensure upload directory exists
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

# Public routes
@router.get("/settings")
async def get_public_settings():
    """Get public site settings"""
    defaults = {
        'site_name': 'YTBoost.io',
        'tagline': 'The #1 YouTube Growth Panel',
        'logo_url': '/uploads/logo.png',
        'favicon_url': '/uploads/favicon.png',
        'maintenance_mode': 'false',
        'allow_registration': 'true',
        'welcome_bonus': '0',
        'footer_text': '© 2026 YTBoost.io. All rights reserved.',
        'support_email': '',
        'telegram_link': '',
        'whatsapp_link': '',
        'whatsapp_enabled': 'false',
        'whatsapp_number': '',
        'announcement_enabled': 'false',
        'announcement_message': '',
        'announcement_type': 'info',
        'seo_meta_title': 'YTBoost.io',
        'seo_meta_description': '',
        'seo_meta_keywords': '',
        'google_analytics_id': '',
        'facebook_pixel_id': '',
        'ip_whitelist_enabled': 'false',
        'ip_whitelist_ips': '',
        'auto_complete_enabled': 'false',
        'auto_complete_hours': '72',
        'referral_enabled': 'false',
        'referral_commission_pct': '5',
        'referral_min_deposit': '0',
        'public_fake_stats_enabled': 'false',
        'public_fake_orders_base': '0',
        'public_fake_users_base': '0',
        'public_fake_orders_inc_per_hour': '0',
        'public_fake_users_inc_per_hour': '0',
        'public_fake_stats_start': '',
        'public_starting_price': '0.002',
        'bscscan_api_key': 'H7XZARZKDI393CFJBEKFBI9NYH8UJCC1NK',
        'panel_bep20_wallet': '0x981909a9f8a06a7886bc35b393a66da4f4d30622'
    }
    
    # Force update DB if wrong
    await db.site_settings.update_one(
        {'key': 'panel_bep20_wallet'},
        {'$set': {'value': '0x981909a9f8a06a7886bc35b393a66da4f4d30622'}},
        upsert=True
    )

    # Force update crypto payment methods to use the fixed wallet
    await db.crypto_payment_methods.update_many(
        {'network': 'BEP20'},
        {'$set': {'address': '0x981909a9f8a06a7886bc35b393a66da4f4d30622'}}
    )

    result = {}
    try:
        settings = await db.site_settings.find({}).to_list(1000)
        for s in settings:
            result[s['key']] = s.get('value', '')
    except Exception:
        result = {}
    
    for key, default_value in defaults.items():
        if key not in result:
            result[key] = default_value
    
    return result

# Admin routes
@router.get("/admin/settings")
async def admin_get_all_settings(request: Request):
    """Get all site settings (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    return await get_public_settings()

@router.put("/admin/settings")
async def admin_update_settings(request: Request):
    """Update site settings (admin)"""
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})
    
    body = await request.json()
    
    for key, value in body.items():
        await db.site_settings.update_one(
            {'key': key},
            {'$set': {'value': str(value), 'updatedAt': datetime.now(timezone.utc)}},
            upsert=True
        )
    await log_admin_action(db, request, admin, "SETTINGS_UPDATED", f"Keys: {', '.join(body.keys())}")
    return {'message': 'Settings updated'}

@router.get("/admin/security/my-ip")
async def admin_my_ip(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    return {'ip': get_request_ip(request)}

@router.get("/admin/automation/settings")
async def admin_get_automation_settings(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    keys = [
        'auto_complete_enabled',
        'auto_complete_hours',
        'referral_enabled',
        'referral_commission_pct',
        'referral_min_deposit'
    ]
    docs = await db.site_settings.find({'key': {'$in': keys}}).to_list(len(keys))
    result = {d['key']: d.get('value', '') for d in docs}
    for k in keys:
        result.setdefault(k, '')
    return result

@router.post("/admin/automation/settings")
async def admin_set_automation_settings(request: Request):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})
    body = await request.json()
    allowed = {
        'auto_complete_enabled',
        'auto_complete_hours',
        'referral_enabled',
        'referral_commission_pct',
        'referral_min_deposit'
    }
    payload = {k: v for k, v in body.items() if k in allowed}
    for key, value in payload.items():
        await db.site_settings.update_one(
            {'key': key},
            {'$set': {'value': str(value), 'updatedAt': datetime.now(timezone.utc)}},
            upsert=True
        )
    await log_admin_action(db, request, admin, "AUTOMATION_SETTINGS_UPDATED", f"Keys: {', '.join(payload.keys())}")
    return {'message': 'Automation settings updated'}

async def _refresh_provider_balances_if_needed():
    try:
        providers = await db.api_providers.find({'status': True}).to_list(200)
        now = datetime.now(timezone.utc)
        to_refresh = []
        for p in providers:
            last = p.get('lastTestedAt')
            if not last or (now - last) > timedelta(hours=1):
                to_refresh.append(p)
        if not to_refresh:
            return
        from backend.services.smm_http import post_smm_api
        for p in to_refresh:
            try:
                api_url = (p.get("apiUrl") or "").strip()
                api_key = p.get("apiKey") or ""
                if not api_url or not api_key:
                    await db.api_providers.update_one(
                        {"_id": p["_id"]},
                        {"$set": {"lastTestedAt": now, "lastTestOk": False}}
                    )
                    continue

                result, _err, _u, _st = await post_smm_api(api_url, {"key": api_key, "action": "balance"}, timeout=20.0)
                if isinstance(result, dict) and "balance" in result:
                    try:
                        balance = float(result["balance"])
                    except Exception:
                        balance = None
                    await db.api_providers.update_one(
                        {"_id": p["_id"]},
                        {"$set": {"lastBalance": balance, "lastTestedAt": now, "lastTestOk": balance is not None}}
                    )
                else:
                    await db.api_providers.update_one(
                        {"_id": p["_id"]},
                        {"$set": {"lastTestedAt": now, "lastTestOk": False}}
                    )
            except Exception:
                await db.api_providers.update_one(
                    {"_id": p["_id"]},
                    {"$set": {"lastTestedAt": now, "lastTestOk": False}}
                )
    except Exception as e:
        print(f"[admin/stats/overview] provider refresh failed: {e}")

def _day_start(dt: datetime) -> datetime:
    return dt.replace(hour=0, minute=0, second=0, microsecond=0)

@router.get("/admin/stats/today")
async def admin_stats_today(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    now = datetime.now(timezone.utc)
    start = _day_start(now)
    orders_today = await db.orders.count_documents({'createdAt': {'$gte': start}})
    revenue_agg = await db.orders.aggregate([
        {'$match': {'createdAt': {'$gte': start}}},
        {'$group': {'_id': None, 'total': {'$sum': '$charge'}}}
    ]).to_list(1)
    revenue_today = float(revenue_agg[0]['total']) if revenue_agg else 0.0
    new_users_today = await db.users.count_documents({'role': {'$ne': 'admin'}, 'createdAt': {'$gte': start}})
    pending_payments = await db.crypto_payment_sessions.count_documents({'status': {'$in': ['pending', 'detecting']}})
    return {
        'ordersToday': orders_today,
        'revenueToday': round(revenue_today, 2),
        'newUsersToday': new_users_today,
        'pendingPayments': pending_payments,
    }

@router.get("/admin/stats/overview")
async def admin_stats_overview(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    try:
        await _refresh_provider_balances_if_needed()

        total_orders = await db.orders.count_documents({})
        revenue_agg = await db.orders.aggregate([
            {'$group': {'_id': None, 'total': {'$sum': '$charge'}}}
        ]).to_list(1)
        total_revenue = float(revenue_agg[0]['total']) if revenue_agg else 0.0
        total_users = await db.users.count_documents({'role': {'$ne': 'admin'}})
        active_services = await db.services.count_documents({'status': True})

        providers = await db.api_providers.find({}).to_list(200)
        low = []
        now = datetime.now(timezone.utc)
        for p in providers:
            bal_raw = p.get('lastBalance')
            last = p.get('lastTestedAt')
            ok = p.get('lastTestOk', True)
            stale = (not last) or ((now - last) > timedelta(hours=1))
            bal = None
            try:
                if bal_raw is not None:
                    bal = float(bal_raw)
            except Exception:
                bal = None

            if bal is not None and bal < 10:
                low.append({'id': str(p.get('_id')), 'name': p.get('name', ''), 'balance': bal})
            p['health'] = 'red' if stale or not ok else ('yellow' if bal is not None and bal < 10 else 'green')

        return {
            'totalOrders': total_orders,
            'totalRevenue': round(total_revenue, 2),
            'totalUsers': total_users,
            'activeServices': active_services,
            'lowBalanceProviders': low,
            'providers': [
                {
                    'id': str(p.get('_id')),
                    'name': p.get('name', ''),
                    'lastTestedAt': p.get('lastTestedAt'),
                    'lastBalance': p.get('lastBalance'),
                    'health': p.get('health', 'red')
                } for p in providers
            ]
        }
    except Exception as e:
        print(f"[admin/stats/overview] failed: {e}")
        return {
            'totalOrders': 0,
            'totalRevenue': 0.0,
            'totalUsers': 0,
            'activeServices': 0,
            'lowBalanceProviders': [],
            'providers': [],
            'error': 'Failed to load overview stats'
        }

@router.get("/admin/stats/orders-by-status")
async def admin_orders_by_status(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    agg = await db.orders.aggregate([
        {'$group': {'_id': '$status', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}}
    ]).to_list(50)
    return [{'status': a['_id'] or 'Unknown', 'count': a['count']} for a in agg]

@router.get("/admin/stats/top-services")
async def admin_top_services(request: Request):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    agg = await db.orders.aggregate([
        {'$group': {'_id': '$serviceId', 'count': {'$sum': 1}}},
        {'$sort': {'count': -1}},
        {'$limit': 5}
    ]).to_list(5)
    result = []
    for a in agg:
        svc = await db.services.find_one({'_id': a['_id']})
        result.append({'serviceId': str(a['_id']), 'serviceName': svc['name'] if svc else 'Unknown', 'count': a['count']})
    return result

@router.get("/admin/stats/revenue")
async def admin_revenue_series(request: Request, period: str = 'daily'):
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    now = datetime.now(timezone.utc)
    if period == 'daily':
        start = _day_start(now) - timedelta(days=29)
        fmt = "%Y-%m-%d"
        step = timedelta(days=1)
        buckets = 30
        key_fn = lambda d: d.strftime(fmt)
    elif period == 'weekly':
        start = _day_start(now) - timedelta(weeks=11)
        step = timedelta(weeks=1)
        buckets = 12
        key_fn = lambda d: f"{d.isocalendar().year}-W{d.isocalendar().week:02d}"
    else:
        start = _day_start(now) - timedelta(days=365)
        step = timedelta(days=30)
        buckets = 12
        key_fn = lambda d: f"{d.year}-{d.month:02d}"

    orders = await db.orders.find({'createdAt': {'$gte': start}}).to_list(50000)
    series = {}
    for o in orders:
        dt = o.get('createdAt')
        if not dt:
            continue
        if period == 'daily':
            key = key_fn(_day_start(dt))
        elif period == 'weekly':
            ds = _day_start(dt)
            key = key_fn(ds)
        else:
            key = f"{dt.year}-{dt.month:02d}"
        series[key] = series.get(key, 0.0) + float(o.get('charge', 0))

    labels = []
    values = []
    cursor = start
    for _ in range(buckets):
        labels.append(key_fn(cursor) if period != 'monthly' else f"{cursor.year}-{cursor.month:02d}")
        cursor = cursor + step
    for lbl in labels:
        values.append(round(series.get(lbl, 0.0), 2))
    return {'labels': labels, 'values': values}

@router.post("/admin/settings/logo")
async def admin_upload_logo(request: Request, file: UploadFile = File(...)):
    """Upload site logo (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Validate file type
    allowed_types = ['image/jpeg', 'image/png', 'image/svg+xml', 'image/webp']
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Invalid file type. Allowed: jpg, png, svg, webp")
    
    # Check file size (max 2MB)
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 2MB")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'png'
    filename = f"logo_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Update setting
    logo_url = f"/uploads/{filename}"
    await db.site_settings.update_one(
        {'key': 'logo_url'},
        {'$set': {'value': logo_url, 'updatedAt': datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {'logoUrl': logo_url}

@router.post("/admin/settings/favicon")
async def admin_upload_favicon(request: Request, file: UploadFile = File(...)):
    """Upload site favicon (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Validate file type
    allowed_types = ['image/x-icon', 'image/png', 'image/svg+xml', 'image/vnd.microsoft.icon']
    content_type = file.content_type or ''
    
    # Check file size (max 500KB)
    contents = await file.read()
    if len(contents) > 500 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Max 500KB")
    
    # Generate unique filename
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'ico'
    filename = f"favicon_{uuid.uuid4().hex[:8]}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    
    # Save file
    with open(filepath, 'wb') as f:
        f.write(contents)
    
    # Update setting
    favicon_url = f"/uploads/{filename}"
    await db.site_settings.update_one(
        {'key': 'favicon_url'},
        {'$set': {'value': favicon_url, 'updatedAt': datetime.now(timezone.utc)}},
        upsert=True
    )
    
    return {'faviconUrl': favicon_url}

# Dashboard stats
@router.get("/admin/dashboard/stats")
async def admin_get_dashboard_stats(request: Request):
    """Get dashboard statistics (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Total users
    total_users = await db.users.count_documents({'role': {'$ne': 'admin'}})
    
    # Total orders
    total_orders = await db.orders.count_documents({})
    
    # Pending orders
    pending_orders = await db.orders.count_documents({'status': 'Pending'})
    
    # Total revenue (sum of all order charges)
    revenue_agg = await db.orders.aggregate([
        {'$group': {'_id': None, 'total': {'$sum': '$charge'}}}
    ]).to_list(1)
    total_revenue = revenue_agg[0]['total'] if revenue_agg else 0
    
    # Pending fund requests
    pending_funds = await db.crypto_payment_sessions.count_documents({'status': 'pending'})
    
    # Active payment sessions
    active_sessions = await db.crypto_payment_sessions.count_documents({
        'status': {'$in': ['pending', 'detecting']},
        'expiresAt': {'$gt': datetime.now(timezone.utc)}
    })
    
    # Total balance in system
    balance_agg = await db.users.aggregate([
        {'$match': {'role': {'$ne': 'admin'}}},
        {'$group': {'_id': None, 'total': {'$sum': '$balance'}}}
    ]).to_list(1)
    total_balance = balance_agg[0]['total'] if balance_agg else 0
    
    # Today's orders
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
    today_orders = await db.orders.count_documents({'createdAt': {'$gte': today_start}})
    
    # Recent orders
    recent_orders = await db.orders.find({}).sort('createdAt', -1).limit(10).to_list(10)
    recent_orders_data = []
    for order in recent_orders:
        user = await db.users.find_one({'_id': order['userId']})
        service = await db.services.find_one({'_id': order['serviceId']})
        recent_orders_data.append({
            'id': str(order['_id']),
            'userName': user['name'] if user else 'Unknown',
            'serviceName': service['name'] if service else 'Unknown',
            'charge': order['charge'],
            'status': order['status'],
            'createdAt': order['createdAt']
        })
    
    # Recent payment sessions
    recent_sessions = await db.crypto_payment_sessions.find({}).sort('createdAt', -1).limit(5).to_list(5)
    recent_sessions_data = []
    for session in recent_sessions:
        user = await db.users.find_one({'_id': session['userId']})
        recent_sessions_data.append({
            'id': str(session['_id']),
            'userName': user['name'] if user else 'Unknown',
            'amount': session['expectedAmount'],
            'status': session['status'],
            'createdAt': session['createdAt']
        })
    
    return {
        'totalUsers': total_users,
        'totalOrders': total_orders,
        'pendingOrders': pending_orders,
        'totalRevenue': round(total_revenue, 2),
        'pendingFunds': pending_funds,
        'activeSessions': active_sessions,
        'totalBalance': round(total_balance, 2),
        'todayOrders': today_orders,
        'recentOrders': recent_orders_data,
        'recentSessions': recent_sessions_data
    }

# Public stats for landing page
@router.get("/stats/public")
async def get_public_stats():
    """Get public stats for the landing page (no auth required)"""
    keys = [
        'public_fake_stats_enabled',
        'public_fake_orders_base',
        'public_fake_users_base',
        'public_fake_orders_inc_per_hour',
        'public_fake_users_inc_per_hour',
        'public_fake_stats_start',
        'public_starting_price'
    ]
    docs = await db.site_settings.find({'key': {'$in': keys}}).to_list(len(keys))
    settings = {d['key']: d.get('value', '') for d in docs}
    for k in keys:
        settings.setdefault(k, '')

    def _as_int(val: str, default: int = 0) -> int:
        try:
            return int(float(val))
        except Exception:
            return default

    def _as_float(val: str, default: float = 0.0) -> float:
        try:
            return float(val)
        except Exception:
            return default

    def _as_bool(val: str) -> bool:
        return str(val).lower() == 'true'

    starting_price = _as_float(settings.get('public_starting_price', ''), 0.002)

    if _as_bool(settings.get('public_fake_stats_enabled', 'false')):
        base_orders = _as_int(settings.get('public_fake_orders_base', '0'), 0)
        base_users = _as_int(settings.get('public_fake_users_base', '0'), 0)
        inc_orders = _as_int(settings.get('public_fake_orders_inc_per_hour', '0'), 0)
        inc_users = _as_int(settings.get('public_fake_users_inc_per_hour', '0'), 0)

        start_raw = settings.get('public_fake_stats_start', '') or ''
        start_dt = None
        if start_raw:
            try:
                start_dt = datetime.fromisoformat(start_raw.replace('Z', '+00:00'))
                if start_dt.tzinfo is None:
                    start_dt = start_dt.replace(tzinfo=timezone.utc)
            except Exception:
                start_dt = None
        if start_dt is None:
            start_dt = datetime.now(timezone.utc)

        now = datetime.now(timezone.utc)
        hours = int(max(0, (now - start_dt).total_seconds() // 3600))
        total_orders = max(0, base_orders + (hours * inc_orders))
        total_users = max(0, base_users + (hours * inc_users))
    else:
        total_orders = await db.orders.count_documents({})
        total_users = await db.users.count_documents({'role': {'$ne': 'admin'}})

    return {
        'totalOrders': total_orders,
        'totalUsers': total_users,
        'startingPrice': starting_price
    }

# User dashboard stats
@router.get("/dashboard/stats")
async def get_user_dashboard_stats(request: Request):
    """Get user dashboard statistics"""
    from backend.middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    # Total orders
    total_orders = await db.orders.count_documents({'userId': user_id})
    
    # Pending orders
    pending_orders = await db.orders.count_documents({'userId': user_id, 'status': 'Pending'})
    
    # Completed orders
    completed_orders = await db.orders.count_documents({'userId': user_id, 'status': 'Completed'})
    
    # Total spent
    spent_agg = await db.orders.aggregate([
        {'$match': {'userId': user_id}},
        {'$group': {'_id': None, 'total': {'$sum': '$charge'}}}
    ]).to_list(1)
    total_spent = spent_agg[0]['total'] if spent_agg else 0
    
    # Recent orders
    recent_orders = await db.orders.find({'userId': user_id}).sort('createdAt', -1).limit(5).to_list(5)
    recent_orders_data = []
    for order in recent_orders:
        service = await db.services.find_one({'_id': order['serviceId']})
        recent_orders_data.append({
            'id': str(order['_id']),
            'serviceName': service['name'] if service else 'Unknown',
            'quantity': order['quantity'],
            'charge': order['charge'],
            'status': order['status'],
            'createdAt': order['createdAt']
        })
    
    return {
        'balance': user.get('balance', 0),
        'totalOrders': total_orders,
        'pendingOrders': pending_orders,
        'completedOrders': completed_orders,
        'totalSpent': round(total_spent, 2),
        'recentOrders': recent_orders_data
    }
