"""
Admin Auth Routes - Separate authentication for admin panel
"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr
from bson import ObjectId

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])

# Request models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

@router.post("/login")
async def admin_login(request: AdminLoginRequest, response: Response):
    from middleware.auth import verify_password
    from middleware.admin import create_admin_access_token, create_admin_refresh_token
    
    email = request.email.lower()
    admin = await db.users.find_one({'email': email, 'role': 'admin'})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    if not verify_password(request.password, admin['password']):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    admin_id = str(admin['_id'])
    
    # Generate admin tokens
    access_token = create_admin_access_token(admin_id, email)
    refresh_token = create_admin_refresh_token(admin_id)
    
    # Set admin cookies
    response.set_cookie(key="admin_access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=1800, path="/")
    response.set_cookie(key="admin_refresh_token", value=refresh_token, httponly=True, secure=False, samesite="lax", max_age=86400, path="/")
    
    return {
        'id': admin_id,
        'name': admin['name'],
        'email': admin['email'],
        'role': 'admin'
    }

@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie(key="admin_access_token", path="/")
    response.delete_cookie(key="admin_refresh_token", path="/")
    return {'message': 'Admin logged out successfully'}

@router.get("/me")
async def get_admin_me(request: Request):
    from middleware.admin import get_current_admin
    
    admin = await get_current_admin(request, db)
    return {
        'id': admin['_id'],
        'name': admin['name'],
        'email': admin['email'],
        'role': 'admin'
    }

@router.post("/refresh")
async def admin_refresh_token(request: Request, response: Response):
    from middleware.admin import verify_admin_refresh_token, create_admin_access_token
    
    token = request.cookies.get('admin_refresh_token')
    if not token:
        raise HTTPException(status_code=401, detail="Admin refresh token not found")
    
    payload = verify_admin_refresh_token(token)
    admin_id = payload['sub']
    
    admin = await db.users.find_one({'_id': ObjectId(admin_id), 'role': 'admin'})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    
    access_token = create_admin_access_token(admin_id, admin['email'])
    response.set_cookie(key="admin_access_token", value=access_token, httponly=True, secure=False, samesite="lax", max_age=1800, path="/")
    
    return {'message': 'Admin token refreshed'}
