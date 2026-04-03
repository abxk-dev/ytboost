"""
Settings Routes - Site settings management
"""
from fastapi import APIRouter, HTTPException, Request, UploadFile, File
from datetime import datetime, timezone
from bson import ObjectId
import os
import shutil
import uuid

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
    settings = await db.site_settings.find({}).to_list(100)
    
    result = {}
    for s in settings:
        result[s['key']] = s['value']
    
    # Default values if not set
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
        'whatsapp_link': ''
    }
    
    for key, default_value in defaults.items():
        if key not in result:
            result[key] = default_value
    
    return result

# Admin routes
@router.get("/admin/settings")
async def admin_get_all_settings(request: Request):
    """Get all site settings (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    return await get_public_settings()

@router.put("/admin/settings")
async def admin_update_settings(request: Request):
    """Update site settings (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    body = await request.json()
    
    for key, value in body.items():
        await db.site_settings.update_one(
            {'key': key},
            {'$set': {'value': str(value), 'updatedAt': datetime.now(timezone.utc)}},
            upsert=True
        )
    
    return {'message': 'Settings updated'}

@router.post("/admin/settings/logo")
async def admin_upload_logo(request: Request, file: UploadFile = File(...)):
    """Upload site logo (admin)"""
    from middleware.admin import get_current_admin
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
    from middleware.admin import get_current_admin
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
    from middleware.admin import get_current_admin
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

# User dashboard stats
@router.get("/dashboard/stats")
async def get_user_dashboard_stats(request: Request):
    """Get user dashboard statistics"""
    from middleware.auth import get_current_user
    
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
