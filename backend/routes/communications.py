from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone, timedelta
from bson import ObjectId

router = APIRouter(tags=["Communications"])

db = None

def set_db(database):
    global db
    db = database

class EmailBlastRequest(BaseModel):
    recipientFilter: str = Field(..., pattern="^(all|balance_gt_0|balance_zero|ordered_last_30_days|specific_emails)$")
    emails: list[str] = []
    subject: str = Field(..., min_length=1, max_length=200)
    message: str = Field(..., min_length=1, max_length=20000)

@router.post("/admin/communications/email-blast")
async def admin_email_blast(request: Request, data: EmailBlastRequest):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    from backend.services.email_service import send_email
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin"})

    query = {'role': {'$ne': 'admin'}}
    if data.recipientFilter == 'balance_gt_0':
        query['balance'] = {'$gt': 0}
    elif data.recipientFilter == 'balance_zero':
        query['balance'] = 0
    elif data.recipientFilter == 'ordered_last_30_days':
        since = datetime.now(timezone.utc) - timedelta(days=30)
        user_ids = await db.orders.distinct('userId', {'createdAt': {'$gte': since}})
        query['_id'] = {'$in': user_ids}
    elif data.recipientFilter == 'specific_emails':
        cleaned = [e.strip().lower() for e in data.emails if e.strip()]
        if not cleaned:
            raise HTTPException(status_code=400, detail="No emails provided")
        query['email'] = {'$in': cleaned}

    users = await db.users.find(query, {'email': 1, 'name': 1}).to_list(100000)
    if not users:
        raise HTTPException(status_code=400, detail="No recipients matched")

    blast_doc = {
        'subject': data.subject,
        'message': data.message,
        'recipientFilter': data.recipientFilter,
        'requestedByAdminId': ObjectId(admin['_id']),
        'sentCount': 0,
        'createdAt': datetime.now(timezone.utc)
    }
    result = await db.email_blasts.insert_one(blast_doc)

    sent = 0
    for u in users:
        try:
            send_email(u.get('email', ''), data.subject, data.message)
        except Exception:
            pass
        try:
            await db.notifications.insert_one({
                'userId': u['_id'],
                'title': data.subject,
                'message': data.message[:2000],
                'type': 'info',
                'read': False,
                'createdAt': datetime.now(timezone.utc)
            })
        except Exception:
            pass
        sent += 1

    await db.email_blasts.update_one({'_id': result.inserted_id}, {'$set': {'sentCount': sent}})
    await log_admin_action(db, request, admin, "EMAIL_BLAST_SENT", f"Blast: {str(result.inserted_id)}, Sent: {sent}, Filter: {data.recipientFilter}")
    return {'message': 'Email blast sent', 'sentCount': sent}

