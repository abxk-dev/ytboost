"""
Auth Routes - User Authentication
"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from bson import ObjectId
import uuid
import re

router = APIRouter(prefix="/auth", tags=["Auth"])

# Request models
class RegisterRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8)
    confirm_password: str = Field(..., alias="confirmPassword")

class LoginRequest(BaseModel):
    email: EmailStr
    password: str

class ChangePasswordRequest(BaseModel):
    current_password: str = Field(..., alias="currentPassword")
    new_password: str = Field(..., min_length=8, alias="newPassword")

# Dependency injection placeholder - will be set by server.py
db = None

def set_db(database):
    global db
    db = database

def validate_password(password: str) -> bool:
    """Validate password has min 8 chars, 1 uppercase, 1 number"""
    if len(password) < 8:
        return False
    if not re.search(r'[A-Z]', password):
        return False
    if not re.search(r'[0-9]', password):
        return False
    return True

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
    
    # Create user
    user_doc = {
        'name': request.name,
        'email': email,
        'password': hash_password(request.password),
        'role': 'user',
        'balance': welcome_bonus,
        'apiKey': str(uuid.uuid4()),
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
    
    # Generate tokens
    access_token = create_access_token(user_id, email)
    refresh_token = create_refresh_token(user_id)
    
    # Set cookies
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    
    return {
        'id': user_id,
        'name': request.name,
        'email': email,
        'balance': welcome_bonus,
        'role': 'user'
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
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    response.set_cookie(key="refresh_token", value=refresh_token, httponly=True, secure=True, samesite="none", max_age=604800, path="/")
    
    return {
        'id': user_id,
        'name': user['name'],
        'email': user['email'],
        'balance': user.get('balance', 0),
        'role': user.get('role', 'user'),
        'apiKey': user.get('apiKey')
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
async def refresh_token(request: Request, response: Response):
    from middleware.auth import verify_refresh_token, create_access_token
    
    token = request.cookies.get('refresh_token')
    if not token:
        raise HTTPException(status_code=401, detail="Refresh token not found")
    
    payload = verify_refresh_token(token)
    user_id = payload['sub']
    
    user = await db.users.find_one({'_id': ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token(user_id, user['email'])
    response.set_cookie(key="access_token", value=access_token, httponly=True, secure=True, samesite="none", max_age=900, path="/")
    
    return {'message': 'Token refreshed'}

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
