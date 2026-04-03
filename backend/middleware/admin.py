"""
Admin Authentication Middleware
Handles JWT token verification for admin routes
Uses separate JWT secret from user auth
"""
import os
import jwt
from datetime import datetime, timezone, timedelta
from fastapi import Request, HTTPException
from bson import ObjectId

ADMIN_JWT_SECRET = os.environ.get('ADMIN_JWT_SECRET', 'ytboost_admin_jwt_secret_key_2024')
JWT_ALGORITHM = "HS256"

def create_admin_access_token(admin_id: str, email: str) -> str:
    """Create JWT access token for admin (30 min expiry)"""
    payload = {
        'sub': admin_id,
        'email': email,
        'role': 'admin',
        'exp': datetime.now(timezone.utc) + timedelta(minutes=30),
        'type': 'admin_access'
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)

def create_admin_refresh_token(admin_id: str) -> str:
    """Create JWT refresh token for admin (1 day expiry)"""
    payload = {
        'sub': admin_id,
        'exp': datetime.now(timezone.utc) + timedelta(days=1),
        'type': 'admin_refresh'
    }
    return jwt.encode(payload, ADMIN_JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_admin(request: Request, db) -> dict:
    """
    Extract and verify admin JWT token from cookie or Authorization header
    Returns admin user document if valid
    """
    # Try cookie first
    token = request.cookies.get('admin_access_token')
    
    # Fallback to Authorization header
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    
    if not token:
        raise HTTPException(status_code=401, detail="Admin not authenticated")
    
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        if payload.get('type') != 'admin_access':
            raise HTTPException(status_code=401, detail="Invalid admin token type")
        
        if payload.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Admin access required")
        
        admin = await db.users.find_one({'_id': ObjectId(payload['sub']), 'role': 'admin'})
        
        if not admin:
            raise HTTPException(status_code=401, detail="Admin not found")
        
        # Return admin without password and convert _id to string
        admin['_id'] = str(admin['_id'])
        admin.pop('password', None)
        
        return admin
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid admin token")

def verify_admin_refresh_token(token: str) -> dict:
    """Verify admin refresh token and return payload"""
    try:
        payload = jwt.decode(token, ADMIN_JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if payload.get('type') != 'admin_refresh':
            raise HTTPException(status_code=401, detail="Invalid admin token type")
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Admin refresh token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid admin refresh token")
