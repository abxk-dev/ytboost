"""
Admin Auth Routes - Separate authentication for admin panel
"""
from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel, EmailStr, Field
from bson import ObjectId
import os
import base64
import io

router = APIRouter(prefix="/admin/auth", tags=["Admin Auth"])

# Request models
class AdminLoginRequest(BaseModel):
    email: EmailStr
    password: str

    otp: str | None = None

class TwoFactorVerifyRequest(BaseModel):
    code: str = Field(..., min_length=6, max_length=6)

class AdminRefreshRequest(BaseModel):
    refresh_token: str | None = Field(default=None, alias="refresh_token")

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def _cookie_settings():
    secure = os.environ.get("COOKIE_SECURE", "true").strip().lower() in {"1", "true", "yes"}
    samesite = "none" if secure else "lax"
    return {"httponly": True, "secure": secure, "samesite": samesite, "path": "/"}

@router.post("/login")
async def admin_login(req: Request, payload: AdminLoginRequest, response: Response):
    from backend.middleware.auth import verify_password
    from backend.middleware.admin import create_admin_access_token, create_admin_refresh_token, get_request_ip, log_admin_action
    import pyotp
    
    email = payload.email.lower()
    admin = await db.users.find_one({'email': email, 'role': 'admin'})
    
    if not admin:
        raise HTTPException(status_code=401, detail="Invalid admin credentials")
    
    if not verify_password(payload.password, admin['password']):
        raise HTTPException(status_code=401, detail="Invalid admin credentials")

    ip_whitelist_enabled = await db.site_settings.find_one({'key': 'ip_whitelist_enabled'})
    if ip_whitelist_enabled and ip_whitelist_enabled.get('value') == 'true':
        ips_doc = await db.site_settings.find_one({'key': 'ip_whitelist_ips'})
        allowed = set((ips_doc.get('value', '') if ips_doc else '').splitlines())
        allowed = {ip.strip() for ip in allowed if ip.strip()}
        ip = get_request_ip(req)
        if allowed and ip not in allowed:
            raise HTTPException(status_code=403, detail="Access denied from this IP")

    if admin.get('twoFactorEnabled'):
        if not payload.otp:
            return {'twoFactorRequired': True}
        secret = admin.get('twoFactorSecret') or ''
        totp = pyotp.TOTP(secret)
        if not totp.verify(payload.otp, valid_window=1):
            raise HTTPException(status_code=401, detail="Invalid 2FA code")
    
    admin_id = str(admin['_id'])
    
    # Generate admin tokens
    access_token = create_admin_access_token(admin_id, email)
    refresh_token = create_admin_refresh_token(admin_id)
    
    # Set admin cookies
    cookie_settings = _cookie_settings()
    response.set_cookie(key="admin_access_token", value=access_token, max_age=1800, **cookie_settings)
    response.set_cookie(key="admin_refresh_token", value=refresh_token, max_age=86400, **cookie_settings)
    
    await log_admin_action(db, req, {'_id': admin_id, 'name': admin.get('name', '')}, "ADMIN_LOGIN", "")
    return {
        'id': admin_id,
        'name': admin['name'],
        'email': admin['email'],
        'role': 'admin',
        'adminRole': admin.get('adminRole', 'superadmin'),
        'twoFactorEnabled': admin.get('twoFactorEnabled', False),
        'access_token': access_token,
        'refresh_token': refresh_token
    }

@router.post("/logout")
async def admin_logout(response: Response):
    response.delete_cookie(key="admin_access_token", path="/")
    response.delete_cookie(key="admin_refresh_token", path="/")
    return {'message': 'Admin logged out successfully'}

@router.get("/me")
async def get_admin_me(request: Request):
    from backend.middleware.admin import get_current_admin
    
    admin = await get_current_admin(request, db)
    return {
        'id': admin['_id'],
        'name': admin['name'],
        'email': admin['email'],
        'role': 'admin',
        'adminRole': admin.get('adminRole', 'superadmin'),
        'twoFactorEnabled': admin.get('twoFactorEnabled', False)
    }

@router.post("/2fa/setup")
async def admin_2fa_setup(request: Request):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    import pyotp
    import qrcode
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    secret = pyotp.random_base32()
    uri = pyotp.TOTP(secret).provisioning_uri(name=admin.get('email', ''), issuer_name="YTBoost Admin")
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    await db.users.update_one({'_id': ObjectId(admin['_id'])}, {'$set': {'twoFactorSecret': secret, 'twoFactorEnabled': False}})
    await log_admin_action(db, request, admin, "ADMIN_2FA_SETUP", "")
    return {'otpauthUri': uri, 'qrCodeBase64': qr_b64}

@router.post("/2fa/enable")
async def admin_2fa_enable(request: Request, data: TwoFactorVerifyRequest):
    from backend.middleware.admin import get_current_admin, log_admin_action
    import pyotp
    admin = await get_current_admin(request, db)
    user = await db.users.find_one({'_id': ObjectId(admin['_id'])})
    secret = (user or {}).get('twoFactorSecret') or ''
    if not secret:
        raise HTTPException(status_code=400, detail="2FA not setup")
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one({'_id': ObjectId(admin['_id'])}, {'$set': {'twoFactorEnabled': True}})
    await log_admin_action(db, request, admin, "ADMIN_2FA_ENABLED", "")
    return {'message': '2FA enabled'}

@router.post("/2fa/disable")
async def admin_2fa_disable(request: Request, data: TwoFactorVerifyRequest):
    from backend.middleware.admin import get_current_admin, log_admin_action
    import pyotp
    admin = await get_current_admin(request, db)
    user = await db.users.find_one({'_id': ObjectId(admin['_id'])})
    secret = (user or {}).get('twoFactorSecret') or ''
    if not secret:
        raise HTTPException(status_code=400, detail="2FA not setup")
    totp = pyotp.TOTP(secret)
    if not totp.verify(data.code, valid_window=1):
        raise HTTPException(status_code=400, detail="Invalid code")
    await db.users.update_one({'_id': ObjectId(admin['_id'])}, {'$set': {'twoFactorEnabled': False}})
    await log_admin_action(db, request, admin, "ADMIN_2FA_DISABLED", "")
    return {'message': '2FA disabled'}

@router.post("/refresh")
async def admin_refresh_token(request: Request, response: Response, body: AdminRefreshRequest | None = None):
    from backend.middleware.admin import verify_admin_refresh_token, create_admin_access_token, create_admin_refresh_token
    
    token = request.cookies.get('admin_refresh_token')
    if not token:
        auth_header = request.headers.get('Authorization', '')
        if auth_header.startswith('Bearer '):
            token = auth_header[7:]
    if not token and body and body.refresh_token:
        token = body.refresh_token
    if not token:
        raise HTTPException(status_code=401, detail="Admin refresh token not found")
    
    payload = verify_admin_refresh_token(token)
    admin_id = payload['sub']
    
    admin = await db.users.find_one({'_id': ObjectId(admin_id), 'role': 'admin'})
    if not admin:
        raise HTTPException(status_code=401, detail="Admin not found")
    
    access_token = create_admin_access_token(admin_id, admin['email'])
    refresh_token = create_admin_refresh_token(admin_id)
    cookie_settings = _cookie_settings()
    response.set_cookie(key="admin_access_token", value=access_token, max_age=1800, **cookie_settings)
    response.set_cookie(key="admin_refresh_token", value=refresh_token, max_age=86400, **cookie_settings)
    
    return {'access_token': access_token, 'refresh_token': refresh_token}
