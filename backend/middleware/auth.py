"""
Authentication Middleware
Handles JWT token verification for user routes
"""
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException
from bson import ObjectId
import bcrypt

JWT_SECRET = os.environ.get('JWT_SECRET', 'ytboost_user_jwt_secret_key_2024')
JWT_REFRESH_SECRET = os.environ.get('JWT_REFRESH_SECRET', 'ytboost_user_refresh_secret_key_2024')
JWT_ALGORITHM = "HS256"

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    salt = bcrypt.gensalt()
    hashed = bcrypt.hashpw(password.encode('utf-8'), salt)
    return hashed.decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))

def create_access_token(user_id: str, email: str) -> str:
    """Create JWT access token (15 min expiry)"""
    payload = {
        'sub': user_id,
        'email': email,
        'exp': datetime.now(timezone.utc) + timedelta(minutes=15),
        'type': 'access'
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_refresh_token(user_id: str) -> str:
    """Create JWT refresh token (7 days expiry)"""
    payload = {
        'sub': user_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=7),
        'type': 'refresh'
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request, db) -> dict:
    """
    Extract and verify JWT token from cookie or Authorization header
    Returns user document if valid
    """
    token = None
    auth_header = request.headers.get('Authorization', '')
    if auth_header.startswith('Bearer '):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get('access_token')
    
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        if payload.get('type') != 'access':
            raise HTTPException(status_code=401, detail="Invalid token type")
        
        user = await db.users.find_one({'_id': ObjectId(payload['sub'])})
        
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        
        if user.get('status') == 'banned':
            raise HTTPException(status_code=403, detail="Account banned")
        
        # Return user without password and convert _id to string
        user['_id'] = str(user['_id'])
        user.pop('password', None)
        
        return user
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

def verify_refresh_token(token: str) -> dict:
    """Verify refresh token and return payload"""
    try:
        payload = jwt.decode(token, JWT_REFRESH_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'refresh':
            raise HTTPException(status_code=401, detail="Invalid token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
