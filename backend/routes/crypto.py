"""
Crypto Routes - BEP20 payment handling
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from typing import Optional

router = APIRouter(tags=["Crypto"])

# Request models
class CreateSessionRequest(BaseModel):
    methodId: str
    amount: float = Field(..., gt=0)

# Dependency injection placeholder
db = None
socket_manager = None

def set_db(database):
    global db
    db = database

def set_socket_manager(manager):
    global socket_manager
    socket_manager = manager

# Public routes
@router.get("/crypto/methods")
async def get_crypto_methods():
    """Get active crypto payment methods"""
    methods = await db.crypto_payment_methods.find({'status': True}).to_list(100)
    
    result = []
    for method in methods:
        result.append({
            'id': str(method['_id']),
            'coinName': method['coinName'],
            'network': method['network'],
            'minAmount': method.get('minAmount', 1),
            'instructions': method.get('instructions', ''),
            'qrCodeUrl': method.get('qrCodeUrl')
        })
    
    return result

# User routes
@router.post("/crypto/create-session")
async def create_payment_session(request: Request, data: CreateSessionRequest):
    """Create a new crypto payment session with unique deposit address"""
    from middleware.auth import get_current_user
    from services.wallet_generator import generate_deposit_address
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    try:
        method_id = ObjectId(data.methodId)
    except:
        raise HTTPException(status_code=400, detail="Invalid method ID")
    
    # Get payment method
    method = await db.crypto_payment_methods.find_one({'_id': method_id, 'status': True})
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")
    
    # Validate amount
    min_amount = method.get('minAmount', 1)
    if data.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum deposit is ${min_amount}")
    
    # Generate unique deposit address
    wallet = generate_deposit_address()
    
    # Create session (expires in 30 minutes)
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=30)
    
    session_doc = {
        'userId': user_id,
        'network': method['network'],
        'coinName': method['coinName'],
        'depositAddress': wallet['address'],
        'encryptedPrivateKey': wallet['encrypted_key'],
        'expectedAmount': data.amount,
        'receivedAmount': None,
        'txHash': None,
        'confirmations': 0,
        'requiredConfirms': method.get('confirmations', 1),
        'status': 'pending',
        'expiresAt': expires_at,
        'detectedAt': None,
        'confirmedAt': None,
        'creditedAt': None,
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.crypto_payment_sessions.insert_one(session_doc)
    session_id = str(result.inserted_id)
    
    return {
        'sessionId': session_id,
        'depositAddress': wallet['address'],
        'amount': data.amount,
        'coinName': method['coinName'],
        'network': method['network'],
        'expiresAt': expires_at.isoformat(),
        'instructions': method.get('instructions', '')
    }

@router.get("/crypto/session/{session_id}")
async def get_payment_session(request: Request, session_id: str):
    """Get payment session status (for polling fallback)"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    
    try:
        obj_id = ObjectId(session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.crypto_payment_sessions.find_one({
        '_id': obj_id,
        'userId': ObjectId(user['_id'])
    })
    
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    return {
        'sessionId': str(session['_id']),
        'depositAddress': session['depositAddress'],
        'expectedAmount': session['expectedAmount'],
        'receivedAmount': session.get('receivedAmount'),
        'txHash': session.get('txHash'),
        'confirmations': session.get('confirmations', 0),
        'requiredConfirms': session.get('requiredConfirms', 1),
        'status': session['status'],
        'coinName': session['coinName'],
        'network': session['network'],
        'expiresAt': session['expiresAt'].isoformat() if session.get('expiresAt') else None,
        'detectedAt': session['detectedAt'].isoformat() if session.get('detectedAt') else None,
        'confirmedAt': session['confirmedAt'].isoformat() if session.get('confirmedAt') else None,
        'creditedAt': session['creditedAt'].isoformat() if session.get('creditedAt') else None
    }

@router.get("/crypto/sessions")
async def get_user_sessions(request: Request, page: int = 1, limit: int = 20):
    """Get user's payment sessions history"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    total = await db.crypto_payment_sessions.count_documents({'userId': user_id})
    
    skip = (page - 1) * limit
    sessions = await db.crypto_payment_sessions.find(
        {'userId': user_id}
    ).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for session in sessions:
        result.append({
            'sessionId': str(session['_id']),
            'expectedAmount': session['expectedAmount'],
            'receivedAmount': session.get('receivedAmount'),
            'txHash': session.get('txHash'),
            'status': session['status'],
            'coinName': session['coinName'],
            'network': session['network'],
            'createdAt': session['createdAt']
        })
    
    return {
        'sessions': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

# Admin routes
@router.get("/admin/crypto-methods")
async def admin_get_crypto_methods(request: Request):
    """Get all crypto payment methods (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    methods = await db.crypto_payment_methods.find({}).to_list(100)
    
    result = []
    for method in methods:
        result.append({
            'id': str(method['_id']),
            'coinName': method['coinName'],
            'network': method['network'],
            'address': method['address'],
            'qrCodeUrl': method.get('qrCodeUrl'),
            'minAmount': method.get('minAmount', 1),
            'instructions': method.get('instructions', ''),
            'autoDetect': method.get('autoDetect', True),
            'confirmations': method.get('confirmations', 1),
            'status': method.get('status', True),
            'createdAt': method.get('createdAt')
        })
    
    return result

@router.post("/admin/crypto-methods")
async def admin_create_crypto_method(request: Request):
    """Create crypto payment method (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    body = await request.json()
    
    method_doc = {
        'coinName': body['coinName'],
        'network': body['network'],
        'address': body['address'],
        'qrCodeUrl': body.get('qrCodeUrl'),
        'minAmount': body.get('minAmount', 1),
        'instructions': body.get('instructions', ''),
        'autoDetect': body.get('autoDetect', True),
        'confirmations': body.get('confirmations', 1),
        'status': body.get('status', True),
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.crypto_payment_methods.insert_one(method_doc)
    
    return {
        'id': str(result.inserted_id),
        **{k: v for k, v in method_doc.items() if k != 'createdAt'}
    }

@router.put("/admin/crypto-methods/{method_id}")
async def admin_update_crypto_method(request: Request, method_id: str):
    """Update crypto payment method (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(method_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid method ID")
    
    body = await request.json()
    
    update_data = {}
    for key in ['coinName', 'network', 'address', 'qrCodeUrl', 'minAmount', 'instructions', 'autoDetect', 'confirmations', 'status']:
        if key in body:
            update_data[key] = body[key]
    
    if update_data:
        await db.crypto_payment_methods.update_one({'_id': obj_id}, {'$set': update_data})
    
    return {'message': 'Payment method updated'}

@router.delete("/admin/crypto-methods/{method_id}")
async def admin_delete_crypto_method(request: Request, method_id: str):
    """Delete crypto payment method (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(method_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid method ID")
    
    result = await db.crypto_payment_methods.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Method not found")
    
    return {'message': 'Payment method deleted'}

@router.patch("/admin/crypto-methods/{method_id}/status")
async def admin_toggle_crypto_method_status(request: Request, method_id: str):
    """Toggle crypto payment method status (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(method_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid method ID")
    
    method = await db.crypto_payment_methods.find_one({'_id': obj_id})
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")
    
    new_status = not method.get('status', True)
    await db.crypto_payment_methods.update_one({'_id': obj_id}, {'$set': {'status': new_status}})
    
    return {'status': new_status}

# Admin fund requests
@router.get("/admin/fund-requests")
async def admin_get_fund_requests(request: Request, page: int = 1, limit: int = 50, status: str = None):
    """Get all payment sessions / fund requests (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    query = {}
    if status:
        query['status'] = status
    
    total = await db.crypto_payment_sessions.count_documents(query)
    
    skip = (page - 1) * limit
    sessions = await db.crypto_payment_sessions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for session in sessions:
        user = await db.users.find_one({'_id': session['userId']})
        result.append({
            'id': str(session['_id']),
            'userId': str(session['userId']),
            'userName': user['name'] if user else 'Unknown',
            'userEmail': user['email'] if user else 'Unknown',
            'expectedAmount': session['expectedAmount'],
            'receivedAmount': session.get('receivedAmount'),
            'txHash': session.get('txHash'),
            'confirmations': session.get('confirmations', 0),
            'status': session['status'],
            'coinName': session['coinName'],
            'network': session['network'],
            'depositAddress': session['depositAddress'],
            'createdAt': session['createdAt'],
            'creditedAt': session.get('creditedAt')
        })
    
    return {
        'requests': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.put("/admin/fund-requests/{session_id}/approve")
async def admin_approve_fund_request(request: Request, session_id: str):
    """Manually approve and credit a fund request (admin)"""
    from middleware.admin import get_current_admin
    from services.webhook_processor import credit_payment
    
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.crypto_payment_sessions.find_one({'_id': obj_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    if session['status'] == 'credited':
        raise HTTPException(status_code=400, detail="Already credited")
    
    # Credit payment
    amount = session.get('receivedAmount') or session['expectedAmount']
    tx_hash = session.get('txHash') or 'MANUAL_APPROVAL'
    
    await credit_payment(session_id, amount, tx_hash, db, socket_manager)
    
    return {'message': 'Fund request approved and credited'}

@router.put("/admin/fund-requests/{session_id}/reject")
async def admin_reject_fund_request(request: Request, session_id: str):
    """Reject a fund request (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(session_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid session ID")
    
    session = await db.crypto_payment_sessions.find_one({'_id': obj_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    
    await db.crypto_payment_sessions.update_one(
        {'_id': obj_id},
        {'$set': {'status': 'failed'}}
    )
    
    return {'message': 'Fund request rejected'}
