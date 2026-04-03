"""
Transactions Routes - Transaction history
"""
from fastapi import APIRouter, HTTPException, Request
from bson import ObjectId

router = APIRouter(tags=["Transactions"])

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

@router.get("/transactions")
async def get_user_transactions(request: Request, page: int = 1, limit: int = 20, type: str = None):
    """Get user's transaction history (authenticated)"""
    from middleware.auth import get_current_user
    
    user = await get_current_user(request, db)
    user_id = ObjectId(user['_id'])
    
    # Build query
    query = {'userId': user_id}
    if type:
        query['type'] = type
    
    total = await db.transactions.count_documents(query)
    
    skip = (page - 1) * limit
    transactions = await db.transactions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for tx in transactions:
        result.append({
            'id': str(tx['_id']),
            'type': tx['type'],
            'amount': tx['amount'],
            'description': tx.get('description', ''),
            'balanceAfter': tx.get('balanceAfter', 0),
            'createdAt': tx['createdAt']
        })
    
    return {
        'transactions': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

# Admin routes
@router.get("/admin/transactions")
async def admin_get_transactions(request: Request, page: int = 1, limit: int = 50, userId: str = None, type: str = None):
    """Get all transactions (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    # Build query
    query = {}
    if userId:
        try:
            query['userId'] = ObjectId(userId)
        except:
            pass
    if type:
        query['type'] = type
    
    total = await db.transactions.count_documents(query)
    
    skip = (page - 1) * limit
    transactions = await db.transactions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)
    
    result = []
    for tx in transactions:
        user = await db.users.find_one({'_id': tx['userId']})
        result.append({
            'id': str(tx['_id']),
            'userId': str(tx['userId']),
            'userName': user['name'] if user else 'Unknown',
            'userEmail': user['email'] if user else 'Unknown',
            'type': tx['type'],
            'amount': tx['amount'],
            'description': tx.get('description', ''),
            'balanceAfter': tx.get('balanceAfter', 0),
            'createdAt': tx['createdAt']
        })
    
    return {
        'transactions': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }
