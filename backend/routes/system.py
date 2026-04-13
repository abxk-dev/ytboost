from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, EmailStr, Field
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(tags=["System"])

db = None

def set_db(database):
    global db
    db = database

class AdminCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=100)
    email: EmailStr
    password: str = Field(..., min_length=8, max_length=128)
    adminRole: str = Field("manager", pattern="^(superadmin|manager|support)$")

class AdminUpdateRequest(BaseModel):
    adminRole: str | None = Field(None, pattern="^(superadmin|manager|support)$")
    status: str | None = Field(None, pattern="^(active|banned)$")

@router.get("/admin/system/activity-log")
async def admin_activity_log(
    request: Request,
    page: int = 1,
    limit: int = 50,
    adminId: str = None,
    action: str = None,
    from_: str = None,
    to: str = None
):
    from backend.middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})

    query = {}
    if adminId:
        try:
            query['adminId'] = ObjectId(adminId)
        except Exception:
            pass
    if action:
        query['action'] = action
    if from_ or to:
        rng = {}
        try:
            if from_:
                rng['$gte'] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            if to:
                rng['$lte'] = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        if rng:
            query['createdAt'] = rng

    total = await db.admin_activity_logs.count_documents(query)
    skip = (page - 1) * limit
    logs = await db.admin_activity_logs.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)

    return {
        'logs': [
            {
                'id': str(l['_id']),
                'adminId': str(l.get('adminId')) if l.get('adminId') else '',
                'adminName': l.get('adminName', ''),
                'action': l.get('action', ''),
                'details': l.get('details', ''),
                'ipAddress': l.get('ipAddress', ''),
                'createdAt': l.get('createdAt')
            } for l in logs
        ],
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.get("/admin/system/activity-log/export")
async def admin_activity_log_export(request: Request, adminId: str = None, action: str = None, from_: str = None, to: str = None):
    data = await admin_activity_log(request, page=1, limit=50000, adminId=adminId, action=action, from_=from_, to=to)
    logs = data.get('logs', [])

    def _iter_csv():
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Timestamp', 'Admin Name', 'Action', 'Details', 'IP Address'])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for l in logs:
            writer.writerow([
                l.get('createdAt').isoformat() if l.get('createdAt') else '',
                l.get('adminName', ''),
                l.get('action', ''),
                l.get('details', ''),
                l.get('ipAddress', '')
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"admin_activity_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(_iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})

@router.get("/admin/admins")
async def admin_list_admins(request: Request):
    from backend.middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})

    admins = await db.users.find({'role': 'admin'}, {'password': 0}).sort('createdAt', -1).to_list(200)
    return [
        {
            'id': str(a['_id']),
            'name': a.get('name', ''),
            'email': a.get('email', ''),
            'adminRole': a.get('adminRole', 'superadmin'),
            'twoFactorEnabled': a.get('twoFactorEnabled', False),
            'status': a.get('status', 'active'),
            'createdAt': a.get('createdAt')
        } for a in admins
    ]

@router.post("/admin/admins")
async def admin_create_admin(request: Request, data: AdminCreateRequest):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    from backend.middleware.auth import hash_password
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})

    email = data.email.lower()
    exists = await db.users.find_one({'email': email})
    if exists:
        raise HTTPException(status_code=400, detail="Email already exists")

    doc = {
        'name': data.name,
        'email': email,
        'password': hash_password(data.password),
        'role': 'admin',
        'adminRole': data.adminRole,
        'twoFactorEnabled': False,
        'twoFactorSecret': None,
        'ipWhitelist': [],
        'balance': 0,
        'apiKey': '',
        'status': 'active',
        'createdAt': datetime.now(timezone.utc)
    }
    result = await db.users.insert_one(doc)
    await log_admin_action(db, request, admin, "ADMIN_CREATED", f"Admin: {email}, Role: {data.adminRole}")
    return {'message': 'Admin created', 'id': str(result.inserted_id)}

@router.put("/admin/admins/{admin_id}")
async def admin_update_admin(request: Request, admin_id: str, data: AdminUpdateRequest):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})
    try:
        obj_id = ObjectId(admin_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid admin ID")
    target = await db.users.find_one({'_id': obj_id, 'role': 'admin'})
    if not target:
        raise HTTPException(status_code=404, detail="Admin not found")
    update = {}
    if data.adminRole:
        update['adminRole'] = data.adminRole
    if data.status:
        update['status'] = data.status
    if not update:
        return {'message': 'No changes'}
    await db.users.update_one({'_id': obj_id}, {'$set': update})
    await log_admin_action(db, request, admin, "ADMIN_UPDATED", f"Admin: {target.get('email','')}, Changes: {update}")
    return {'message': 'Admin updated'}

