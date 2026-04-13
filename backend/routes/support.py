from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId

router = APIRouter(tags=["Support"])

db = None

def set_db(database):
    global db
    db = database

class CreateTicketRequest(BaseModel):
    subject: str = Field(..., min_length=2, max_length=120)
    message: str = Field(..., min_length=1, max_length=5000)
    category: str = Field(..., pattern="^(Payment Issue|Order Issue|Technical|Other)$")

class ReplyTicketRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=5000)

class UpdateTicketStatusRequest(BaseModel):
    status: str = Field(..., pattern="^(open|in_progress|closed|resolved)$")

def _ticket_to_dict(t):
    return {
        'id': str(t['_id']),
        'userId': str(t['userId']),
        'subject': t.get('subject', ''),
        'category': t.get('category', ''),
        'status': t.get('status', 'open'),
        'adminUnread': t.get('adminUnread', False),
        'userUnread': t.get('userUnread', False),
        'createdAt': t.get('createdAt'),
        'updatedAt': t.get('updatedAt'),
        'lastReplyAt': t.get('lastReplyAt'),
        'lastReplyRole': t.get('lastReplyRole', ''),
        'messages': [
            {
                'senderId': str(m.get('senderId')) if m.get('senderId') else '',
                'senderRole': m.get('senderRole', ''),
                'message': m.get('message', ''),
                'createdAt': m.get('createdAt')
            } for m in t.get('messages', [])
        ]
    }

@router.get("/user/support/tickets")
async def user_list_tickets(request: Request):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    tickets = await db.support_tickets.find({'userId': user_id}).sort('updatedAt', -1).to_list(200)
    return [{'id': str(t['_id']), 'subject': t.get('subject',''), 'category': t.get('category',''), 'status': t.get('status','open'), 'lastReplyAt': t.get('lastReplyAt'), 'userUnread': t.get('userUnread', False), 'updatedAt': t.get('updatedAt')} for t in tickets]

@router.post("/user/support/tickets")
async def user_create_ticket(request: Request, data: CreateTicketRequest):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    now = datetime.now(timezone.utc)
    doc = {
        'userId': user_id,
        'subject': data.subject,
        'category': data.category,
        'status': 'open',
        'messages': [
            {
                'senderId': user_id,
                'senderRole': 'user',
                'message': data.message,
                'createdAt': now
            }
        ],
        'adminUnread': True,
        'userUnread': False,
        'createdAt': now,
        'updatedAt': now,
        'lastReplyAt': now,
        'lastReplyRole': 'user'
    }
    result = await db.support_tickets.insert_one(doc)
    await db.user_activity_logs.insert_one({'userId': user_id, 'action': 'Support Ticket', 'details': f'Created ticket {data.subject}', 'createdAt': now})
    return {'message': 'Ticket created', 'id': str(result.inserted_id)}

@router.get("/user/support/tickets/{ticket_id}")
async def user_get_ticket(request: Request, ticket_id: str):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    t = await db.support_tickets.find_one({'_id': obj_id, 'userId': user_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.support_tickets.update_one({'_id': obj_id}, {'$set': {'userUnread': False}})
    t['userUnread'] = False
    return _ticket_to_dict(t)

@router.post("/user/support/tickets/{ticket_id}/reply")
async def user_reply_ticket(request: Request, ticket_id: str, data: ReplyTicketRequest):
    from backend.middleware.auth import get_current_user
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    t = await db.support_tickets.find_one({'_id': obj_id, 'userId': user_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    now = datetime.now(timezone.utc)
    msg = {'senderId': user_id, 'senderRole': 'user', 'message': data.message, 'createdAt': now}
    await db.support_tickets.update_one(
        {'_id': obj_id},
        {'$push': {'messages': msg}, '$set': {'updatedAt': now, 'lastReplyAt': now, 'lastReplyRole': 'user', 'adminUnread': True}}
    )
    return {'message': 'Reply added'}

@router.get("/admin/support/tickets")
async def admin_list_tickets(request: Request, status: str = None, category: str = None):
    from backend.middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    query = {}
    if status and status != 'all':
        query['status'] = status
    if category and category != 'all':
        query['category'] = category
    tickets = await db.support_tickets.find(query).sort('updatedAt', -1).to_list(500)
    unread = await db.support_tickets.count_documents({'adminUnread': True})
    user_ids = list({t['userId'] for t in tickets if t.get('userId')})
    users = await db.users.find({'_id': {'$in': user_ids}}, {'name': 1, 'email': 1}).to_list(len(user_ids) or 1)
    user_map = {u['_id']: u for u in users}
    return {
        'unread': unread,
        'tickets': [
            {
                'id': str(t['_id']),
                'userId': str(t['userId']),
                'userName': user_map.get(t['userId'], {}).get('name', 'Unknown'),
                'userEmail': user_map.get(t['userId'], {}).get('email', 'Unknown'),
                'subject': t.get('subject', ''),
                'category': t.get('category', ''),
                'status': t.get('status', 'open'),
                'adminUnread': t.get('adminUnread', False),
                'lastReplyAt': t.get('lastReplyAt'),
                'lastReplyRole': t.get('lastReplyRole', ''),
                'updatedAt': t.get('updatedAt'),
            } for t in tickets
        ]
    }

@router.get("/admin/support/tickets/{ticket_id}")
async def admin_get_ticket(request: Request, ticket_id: str):
    from backend.middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    t = await db.support_tickets.find_one({'_id': obj_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.support_tickets.update_one({'_id': obj_id}, {'$set': {'adminUnread': False}})
    t['adminUnread'] = False
    return _ticket_to_dict(t)

@router.post("/admin/support/tickets/{ticket_id}/reply")
async def admin_reply_ticket(request: Request, ticket_id: str, data: ReplyTicketRequest):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    t = await db.support_tickets.find_one({'_id': obj_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    now = datetime.now(timezone.utc)
    msg = {'senderId': ObjectId(admin['_id']), 'senderRole': 'admin', 'message': data.message, 'createdAt': now}
    await db.support_tickets.update_one(
        {'_id': obj_id},
        {'$push': {'messages': msg}, '$set': {'updatedAt': now, 'lastReplyAt': now, 'lastReplyRole': 'admin', 'adminUnread': False, 'userUnread': True}}
    )
    await db.notifications.insert_one({'userId': t['userId'], 'title': 'Support reply', 'message': data.message[:160], 'type': 'info', 'read': False, 'createdAt': now})
    await log_admin_action(db, request, admin, "SUPPORT_REPLY", f"Ticket: {ticket_id}")
    return {'message': 'Reply added'}

@router.put("/admin/support/tickets/{ticket_id}/status")
async def admin_update_ticket_status(request: Request, ticket_id: str, data: UpdateTicketStatusRequest):
    from backend.middleware.admin import get_current_admin, require_admin_role, log_admin_action
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager", "support"})
    try:
        obj_id = ObjectId(ticket_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ticket ID")
    t = await db.support_tickets.find_one({'_id': obj_id})
    if not t:
        raise HTTPException(status_code=404, detail="Ticket not found")
    now = datetime.now(timezone.utc)
    await db.support_tickets.update_one({'_id': obj_id}, {'$set': {'status': data.status, 'updatedAt': now}})
    await log_admin_action(db, request, admin, "SUPPORT_STATUS", f"Ticket: {ticket_id}, Status: {data.status}")
    return {'message': 'Status updated'}

