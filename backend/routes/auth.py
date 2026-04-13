"""
Auth Routes - User Authentication
"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import re
import os

router = APIRouter(prefix="/auth", tags=["Auth"])

# Request models
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., alias="confirmPassword")
    ref: str | None = None

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., alias="currentPassword")
    new_password: str = Field(..., min_length=8, alias="newPassword")

class RefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, alias="refresh_token")

# Dependency injection placeholder - will be set by server.py
db = None

def set_db(database):
    global db
    db = database

def _cookie_settings():
    secure = os.environ.get("COOKIE_SECURE", "true").strip().lower() in {"1", "true", "yes"}
    samesite = "none" if secure else "lax"
    return {"httponly": True, "secure": secure, "samesite": samesite, "path": "/"}

def validate_password(password: str) -> bool:
    """Validate password has min 8 chars, 1 uppercase, 1 number"""
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    return True

async def _generate_unique_referral_code() -> str:
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    for _ in range(50):
        code = "".join(alphabet[uuid.uuid4().int % len(alphabet)] for _ in range(8))
        exists = await db.users.find_one({'referralCode': code}, {'_id': 1})
        if not exists:
            return code
    return uuid.uuid4().hex[:10].upper()

@router.post("/register")
async def register(request: RegisterRequest, response: Response):
    from middleware.auth import hash_password, create_access_token, create_refresh_token
    
    # Validate passwords match
    if request.password != request.confirm_password:
        raise HTTPException(status_code=400, detail="Passwords do not match")
    
    # Validate password strength
    if not validate_password(request.password):
        raise HTTPException(status_code=400, detail="Password must be at least 8 characters with 1 uppercase and 1 number")
    
    # Check email uniqueness
    email = request.email.lower()
    existing = await db.users.find_one({'email': email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Get welcome bonus from settings
    welcome_bonus = 0
    settings = await db.site_settings.find_one({'key': 'welcome_bonus'})
    if settings:
        try:
            welcome_bonus = float(settings.get('value', 0))
        except:
            welcome_bonus = 0

    referred_by = None
    if request.ref:
        referrer = await db.users.find_one({'referralCode': request.ref}, {'_id': 1, 'role': 1})
        if referrer and referrer.get('role') != 'admin':
            referred_by = referrer['_id']

    referral_code = await _generate_unique_referral_code()
    
    # Create user
    user_doc = {
        'name': request.name,
        'email': email,
        'password': hash_password(request.password),
        'role': 'user',
        'balance': welcome_bonus,
        'apiKey': str(uuid.uuid4()),
        'referralCode': referral_code,
        'referredBy': referred_by,
        'referralEarnings': 0,
        'status': 'active',
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.users.insert_one(user_doc)
    user_id = str(result.inserted_id)
    
    # Create welcome bonus transaction if applicable
    if welcome_bonus > 0:
        await db.transactions.insert_one({
            'userId': result.inserted_id,
            'type': 'credit',
            'amount': welcome_bonus,
            'description': 'Welcome bonus',
            'balanceAfter': welcome_bonus,
            'createdAt': datetime.now(timezone.utc)
        })
        await db.notifications.insert_one({
            'userId': result.inserted_id,
            'title': 'Welcome bonus',
            'message': f'Welcome! You received a ${welcome_bonus:.2f} bonus to get started!',
            'type': 'success',
            'read': False,
            'createdAt': datetime.now(timezone.utc)
        })
    await db.user_activity_logs.insert_one({
        'userId': result.inserted_id,
        'action': 'Register',
        'details': '',
        'createdAt': datetime.now(timezone.utc)
    })
    
    # Generate tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    cookie_settings = _cookie_settings()
    response.set_cookie(key="access_token", value=access_token, max_age=900, **cookie_settings)
    response.set_cookie(key="refresh_token", value=refresh_token, max_age=604800, **cookie_settings)
    
    return {
        'id': user_id,
        'name': request.name,
        'email': email,
        'balance': welcome_bonus,
        'role': 'user',
        'access_token': access_token,
        'refresh_token': refresh_token
    }

@router.post("/login")
async def login(request: LoginRequest, response: Response):
    from middleware.auth import verify_password, create_access_token, create_refresh_token
    
    email = request.email.lower()
    user = await db.users.find_one({'email': email})
    
    if not user:
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get('role') == 'admin':
        raise HTTPException(status_code=401, detail="Please use admin login")
    
    if not verify_password(request.password, user['password']):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    
    if user.get('status') == 'banned':
        raise HTTPException(status_code=403, detail="Account has been banned")
    
    user_id = str(user['_id'])
    
    # Generate tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    cookie_settings = _cookie_settings()
    response.set_cookie(key="access_token", value=access_token, max_age=900, **cookie_settings)
    response.set_cookie(key="refresh_token", value=refresh_token, max_age=604800, **cookie_settings)

    await db.user_activity_logs.insert_one({
        'userId': ObjectId(user_id),
        'action': 'Login',
        'details': '',
        'createdAt': datetime.now(timezone.utc)
    })
    
    return {
        'id': user_id,
        'name': user['name'],
        'email': user['email'],
        'balance': user.get('balance', 0),
        'role': user.get('role', 'user'),
        'apiKey': user.get('apiKey'),
        'access_token': access_token,
        'refresh_token': refresh_token
    }

@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie(key="access_token", path="/")
    response.delete_cookie(key="refresh_token", path="/")
    return {'message': 'Logged out successfully'}

@router.get("/me")
async def get_me(request: Request):
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    return {
        'id': user['_id'],
        'name': user['name'],
        'email': user['email'],
        'balance': user.get('balance', 0),
        'role': user.get('role', 'user'),
        'apiKey': user.get('apiKey'),
        'status': user.get('status', 'active'),
        'createdAt': user.get('createdAt')
    }

@router.post("/refresh")
async def refresh_token(request: Request, response: Response, body: RefreshRequest | None = None):
    from middleware.auth import verify_refresh_token, create_access_token, create_refresh_token
    
    token = request.cookies.get('refresh_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token and body and body.refresh_token:
        token = body.refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    payload = verify_refresh_token(token)
    user_id = payload['sub']
    
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token(user_id, user['email'])
    new_refresh = create_refresh_token(user_id)
    cookie_settings = _cookie_settings()
    response.set_cookie(key="access_token", value=access_token, max_age=900, **cookie_settings)
    response.set_cookie(key="refresh_token", value=new_refresh, max_age=604800, **cookie_settings)
    
    return {'access_token': access_token, 'refresh_token': new_refresh}

@router.post("/change-password")
async def change_password(request: Request, data: ChangePasswordRequest):
    from middleware.auth import get_current_user, verify_password, hash_password
    
    user = await get_current_user(request, db)
    
    # Get user with password
    user_doc = await db.users.find_one({'_id': ObjectId(user['_id'])})
    
    if not verify_password(data.current_password, user_doc['password']):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    if not validate_password(data.new_password):
        raise HTTPException(status_code=400, detail="New password must be at least 8 characters with 1 uppercase and 1 number")
    
    # Update password
    await db.users.update_one(
        {'_id': ObjectId(user['_id'])},
        {'$set': {'password': hash_password(data.new_password)}}
    )

    await db.user_activity_logs.insert_one({
        'userId': ObjectId(user['_id']),
        'action': 'Password Changed',
        'details': '',
        'createdAt': datetime.now(timezone.utc)
    })
    
    return {'message': 'Password changed successfully'}

@router.put("/account")
async def update_account(request: Request):
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    body = await request.json()
    
    update_data = {}
    if 'name' in body:
        update_data['name'] = body['name']
    
    if update_data:
        await db.users.update_one(
            {'_id': ObjectId(user['_id'])},
            {'$set': update_data}
        )
    
    return {'message': 'Account updated successfully'}

@router.post("/regenerate-api-key")
async def regenerate_api_key(request: Request):
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    new_key = str(uuid.uuid4())
    
    await db.users.update_one(
        {'_id': ObjectId(user['_id'])},
        {'$set': {'apiKey': new_key}}
    )
    
    return {'apiKey': new_key}
