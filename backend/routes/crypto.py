"""
Crypto Routes - BEP20 payment handling
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from bson import ObjectId
from typing import Optional
import os

router = APIRouter(tags=["Crypto"])

# Request models
class CreateSessionRequest(BaseModel):
    methodId: str
    amount: float = Field(..., gt=0)

class VerifyTxHashRequest(BaseModel):
    sessionId: str
    txHash: str = Field(..., min_length=64, max_length=66)

class RejectFundRequest(BaseModel):
    reason: str = Field("", max_length=500)

# Dependency injection placeholder
db = None
socket_manager = None

def set_db(database):
    global db
    db = database

def set_socket_manager(manager):
    global socket_manager
    socket_manager = manager

# STRICT OVERRIDE - Always return the correct fixed wallet
STRICT_WALLET = "0x981909a9f8a06a7886bc35b393a66da4f4d30622"


# ── Public routes ──────────────────────────────────────────────────────────────

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
            'address': STRICT_WALLET,  # STRICT OVERRIDE
            'minAmount': method.get('minAmount', 1),
            'instructions': method.get('instructions', ''),
            'qrCodeUrl': method.get('qrCodeUrl'),
        })

    return result


@router.get("/crypto/monitor-health")
async def crypto_monitor_health():
    from backend.services.blockchain_scheduler import scheduler
    from backend.services.bep20_monitor import get_web3

    web3_ok = False
    try:
        web3_ok = bool(get_web3().is_connected())
    except Exception:
        web3_ok = False

    jobs = []
    try:
        if scheduler:
            for j in scheduler.get_jobs():
                jobs.append({
                    'id': j.id,
                    'nextRunTime': j.next_run_time.isoformat() if j.next_run_time else None,
                })
    except Exception:
        jobs = []

    return {
        'web3Connected': web3_ok,
        'schedulerRunning': bool(scheduler),
        'jobs': jobs,
    }


# ── User routes ────────────────────────────────────────────────────────────────

@router.post("/crypto/create-session")
async def create_payment_session(request: Request, data: CreateSessionRequest):
    """Create a new crypto payment session with FIXED deposit address"""
    from backend.middleware.auth import get_current_user

    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])

    try:
        method_id = ObjectId(data.methodId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid method ID")

    # Get payment method
    method = await db.crypto_payment_methods.find_one({'_id': method_id, 'status': True})
    if not method:
        raise HTTPException(status_code=404, detail="Payment method not found")

    # Validate amount
    min_amount = method.get('minAmount', 1)
    if data.amount < min_amount:
        raise HTTPException(status_code=400, detail=f"Minimum deposit is ${min_amount}")

    ttl_minutes_raw = os.environ.get("PAYMENT_SESSION_TTL_MINUTES", "120")
    try:
        ttl_minutes = int(float(ttl_minutes_raw))
    except Exception:
        ttl_minutes = 120
    ttl_minutes = max(10, min(24 * 60, ttl_minutes))

    expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)

    session_doc = {
        'userId': user_id,
        'network': method['network'],
        'coinName': method['coinName'],
        'depositAddress': STRICT_WALLET,
        'encryptedPrivateKey': None,   # Removed dynamic logic
        'isFixedWallet': True,          # Always fixed
        'expectedAmount': data.amount,
        'receivedAmount': None,
        'txHash': None,
        'confirmations': 0,
        'requiredConfirms': method.get('confirmations', 2),
        'status': 'pending',
        'expiresAt': expires_at,
        'detectedAt': None,
        'confirmedAt': None,
        'creditedAt': None,
        'createdAt': datetime.now(timezone.utc),
    }

    result = await db.crypto_payment_sessions.insert_one(session_doc)
    session_id = str(result.inserted_id)

    return {
        'sessionId': session_id,
        'depositAddress': STRICT_WALLET,
        'isFixedWallet': True,
        'amount': data.amount,
        'coinName': method['coinName'],
        'network': method['network'],
        'expiresAt': expires_at.isoformat(),
        'ttlMinutes': ttl_minutes,
        'instructions': method.get('instructions', ''),
    }


@router.get("/crypto/session/{session_id}")
async def get_payment_session(request: Request, session_id: str):
    """Get payment session status (for polling fallback)"""
    from backend.middleware.auth import get_current_user

    user = await get_current_user(request, db)

    try:
        obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db.crypto_payment_sessions.find_one({
        '_id': obj_id,
        'userId': ObjectId(user['_id']),
    })

    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    now = datetime.now(timezone.utc)
    expires_at = session.get('expiresAt')
    if isinstance(expires_at, datetime) and expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)

    grace_raw = os.environ.get("PAYMENT_SESSION_GRACE_MINUTES", "360")
    try:
        grace_minutes = int(float(grace_raw))
    except Exception:
        grace_minutes = 360
    grace_minutes = max(0, min(7 * 24 * 60, grace_minutes))
    cutoff = now - timedelta(minutes=grace_minutes)

    return {
        'sessionId': str(session['_id']),
        'depositAddress': STRICT_WALLET,  # STRICT OVERRIDE (module-level constant)
        'expectedAmount': session['expectedAmount'],
        'receivedAmount': session.get('receivedAmount'),
        'txHash': session.get('txHash'),
        'confirmations': session.get('confirmations', 0),
        'requiredConfirms': session.get('requiredConfirms', 1),
        'status': session['status'],
        'isFixedWallet': session.get('isFixedWallet', False),
        'coinName': session['coinName'],
        'network': session['network'],
        'expiresAt': expires_at.isoformat() if isinstance(expires_at, datetime) else None,
        'graceCutoff': cutoff.isoformat(),
        'detectedAt': session['detectedAt'].isoformat() if session.get('detectedAt') else None,
        'confirmedAt': session['confirmedAt'].isoformat() if session.get('confirmedAt') else None,
        'creditedAt': session['creditedAt'].isoformat() if session.get('creditedAt') else None,
    }


@router.get("/crypto/sessions")
async def get_user_sessions(request: Request, page: int = 1, limit: int = 20):
    """Get user's payment sessions history"""
    from backend.middleware.auth import get_current_user

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
            'createdAt': session['createdAt'],
        })

    return {
        'sessions': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit,
    }


@router.post("/crypto/verify-hash")
async def verify_payment_hash(request: Request, data: VerifyTxHashRequest):
    """
    Manually verify a BEP20 USDT transfer via BscScan API.
    Allows users to submit their txHash for manual verification if auto-detect fails.
    """
    from backend.middleware.auth import get_current_user
    from backend.services.bscscan_service import verify_tx_hash_bscscan
    from backend.services.webhook_processor import credit_payment

    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])

    try:
        session_id = ObjectId(data.sessionId)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    # 1. Get session
    session = await db.crypto_payment_sessions.find_one({'_id': session_id, 'userId': user_id})
    if not session:
        raise HTTPException(status_code=404, detail="Payment session not found")

    if session['status'] == 'credited':
        return {"message": "Payment already credited", "status": "credited"}

    # 2. Check for double-spending — reject if txHash already used in another session
    existing = await db.crypto_payment_sessions.find_one({
        'txHash': data.txHash,
        '_id': {'$ne': session_id},
        'status': {'$in': ['confirmed', 'credited']},
    })
    if existing:
        raise HTTPException(status_code=400, detail="This transaction hash has already been used")

    # 3. Get BscScan API key from site settings / env
    bscscan_setting = await db.site_settings.find_one({'key': 'bscscan_api_key'})
    api_key = bscscan_setting.get('value', '') if bscscan_setting else os.environ.get('BSCSCAN_API_KEY', '')

    if not api_key:
        raise HTTPException(status_code=400, detail="BscScan verification is not configured by admin")

    # 4. Verify via BscScan
    result = await verify_tx_hash_bscscan(data.txHash, STRICT_WALLET, api_key)

    if not isinstance(result, dict):
        raise HTTPException(status_code=400, detail=f"BscScan error: {result}")

    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "Verification failed"))

    # 5. Extract verified values
    amount = float(result["amount"])
    confirmations = int(result["confirmations"])

    # 6. Amount check (allow 1 % tolerance)
    if amount < session['expectedAmount'] * 0.99:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Transaction amount ({amount} USDT) is less than "
                f"expected ({session['expectedAmount']} USDT)"
            ),
        )

    # 7. Persist detection info
    required_confirms = session.get('requiredConfirms', 1)
    new_status = 'confirmed' if confirmations >= required_confirms else 'detecting'

    await db.crypto_payment_sessions.update_one(
        {'_id': session_id},
        {
            '$set': {
                'txHash': data.txHash,
                'receivedAmount': amount,
                'confirmations': confirmations,
                'detectedAt': datetime.now(timezone.utc),
                'status': new_status,
            }
        },
    )

    # 8. Credit if fully confirmed
    if confirmations >= required_confirms:
        await credit_payment(str(session_id), amount, data.txHash, db, socket_manager)
        return {
            "message": "Payment verified and credited successfully",
            "status": "credited",
        }

    return {
        "message": "Payment detected. Waiting for confirmations.",
        "status": "detecting",
        "confirmations": confirmations,
    }


# ── Admin routes ───────────────────────────────────────────────────────────────

@router.get("/admin/crypto-methods")
async def admin_get_crypto_methods(request: Request):
    """Get all crypto payment methods (admin)"""
    from backend.middleware.admin import get_current_admin
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
            'createdAt': method.get('createdAt'),
        })

    return result


@router.post("/admin/crypto-methods")
async def admin_create_crypto_method(request: Request):
    """Create crypto payment method (admin)"""
    from backend.middleware.admin import get_current_admin
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
        'createdAt': datetime.now(timezone.utc),
    }

    result = await db.crypto_payment_methods.insert_one(method_doc)

    return {
        'id': str(result.inserted_id),
        **{k: v for k, v in method_doc.items() if k != 'createdAt'},
    }


@router.put("/admin/crypto-methods/{method_id}")
async def admin_update_crypto_method(request: Request, method_id: str):
    """Update crypto payment method (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(method_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid method ID")

    body = await request.json()

    update_data = {
        key: body[key]
        for key in [
            'coinName', 'network', 'address', 'qrCodeUrl',
            'minAmount', 'instructions', 'autoDetect', 'confirmations', 'status',
        ]
        if key in body
    }

    if update_data:
        await db.crypto_payment_methods.update_one({'_id': obj_id}, {'$set': update_data})

    return {'message': 'Payment method updated'}


@router.delete("/admin/crypto-methods/{method_id}")
async def admin_delete_crypto_method(request: Request, method_id: str):
    """Delete crypto payment method (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(method_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid method ID")

    result = await db.crypto_payment_methods.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Method not found")

    return {'message': 'Payment method deleted'}


@router.patch("/admin/crypto-methods/{method_id}/status")
async def admin_toggle_crypto_method_status(request: Request, method_id: str):
    """Toggle crypto payment method status (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    try:
        obj_id = ObjectId(method_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid method ID")

    method = await db.crypto_payment_methods.find_one({'_id': obj_id})
    if not method:
        raise HTTPException(status_code=404, detail="Method not found")

    new_status = not method.get('status', True)
    await db.crypto_payment_methods.update_one({'_id': obj_id}, {'$set': {'status': new_status}})

    return {'status': new_status}


# ── Admin fund requests ────────────────────────────────────────────────────────

@router.get("/admin/fund-requests")
async def admin_get_fund_requests(
    request: Request,
    page: int = 1,
    limit: int = 50,
    status: str = None,
):
    """Get all payment sessions / fund requests (admin)"""
    from backend.middleware.admin import get_current_admin
    await get_current_admin(request, db)

    query = {}
    if status:
        query['status'] = status

    total = await db.crypto_payment_sessions.count_documents(query)

    skip = (page - 1) * limit
    sessions = await (
        db.crypto_payment_sessions.find(query)
        .sort('createdAt', -1)
        .skip(skip)
        .limit(limit)
        .to_list(limit)
    )

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
            'creditedAt': session.get('creditedAt'),
        })

    return {
        'requests': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit,
    }


@router.put("/admin/fund-requests/{session_id}/approve")
async def admin_approve_fund_request(request: Request, session_id: str):
    """Manually approve and credit a fund request (admin)"""
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role
    from backend.services.webhook_processor import credit_payment

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    try:
        obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db.crypto_payment_sessions.find_one({'_id': obj_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    if session['status'] == 'credited':
        raise HTTPException(status_code=400, detail="Already credited")

    amount = session.get('receivedAmount') or session['expectedAmount']
    tx_hash = session.get('txHash') or 'MANUAL_APPROVAL'

    await credit_payment(session_id, amount, tx_hash, db, socket_manager)

    await log_admin_action(
        db, request, admin,
        "FUND_REQUEST_APPROVED",
        f"Session: {session_id}, Amount: {amount}",
    )
    return {'message': 'Fund request approved and credited'}


@router.put("/admin/fund-requests/{session_id}/reject")
async def admin_reject_fund_request(request: Request, session_id: str, data: RejectFundRequest):
    """Reject a fund request (admin)"""
    from backend.middleware.admin import get_current_admin, log_admin_action, require_admin_role

    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    try:
        obj_id = ObjectId(session_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid session ID")

    session = await db.crypto_payment_sessions.find_one({'_id': obj_id})
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    await db.crypto_payment_sessions.update_one(
        {'_id': obj_id},
        {
            '$set': {
                'status': 'failed',
                'rejectedReason': data.reason,
                'rejectedAt': datetime.now(timezone.utc),
            }
        },
    )

    try:
        amount = session.get('receivedAmount') or session.get('expectedAmount') or 0
        msg = (
            f'Your deposit of ${float(amount):.2f} was rejected. Reason: {data.reason}'
            if data.reason
            else f'Your deposit of ${float(amount):.2f} was rejected.'
        )
        await db.notifications.insert_one({
            'userId': session['userId'],
            'title': 'Deposit rejected',
            'message': msg,
            'type': 'warning',
            'read': False,
            'createdAt': datetime.now(timezone.utc),
        })
    except Exception:
        pass

    await log_admin_action(
        db, request, admin,
        "FUND_REQUEST_REJECTED",
        f"Session: {session_id}, Reason: {data.reason}",
    )

    return {'message': 'Fund request rejected'}