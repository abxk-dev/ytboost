"""
Transactions Routes - Transaction history
"""
from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse
from bson import ObjectId
from datetime import datetime, timezone

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

@router.get("/admin/finance/transactions")
async def admin_finance_transactions(
    request: Request,
    page: int = 1,
    limit: int = 50,
    search: str = None,
    type: str = None,
    from_: str = None,
    to: str = None
):
    from middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    query = {}
    if type and type != 'all':
        query['type'] = type

    if from_ or to:
        created = {}
        try:
            if from_:
                created['$gte'] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            if to:
                created['$lte'] = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        if created:
            query['createdAt'] = created

    if search:
        users = await db.users.find({'email': {'$regex': search, '$options': 'i'}}, {'_id': 1}).to_list(2000)
        if not users:
            return {'transactions': [], 'total': 0, 'page': page, 'pages': 0}
        query['userId'] = {'$in': [u['_id'] for u in users]}

    total = await db.transactions.count_documents(query)
    skip = (page - 1) * limit
    transactions = await db.transactions.find(query).sort('createdAt', -1).skip(skip).limit(limit).to_list(limit)

    user_ids = list({tx['userId'] for tx in transactions if tx.get('userId')})
    users = await db.users.find({'_id': {'$in': user_ids}}, {'name': 1, 'email': 1}).to_list(len(user_ids) or 1)
    user_map = {u['_id']: u for u in users}

    result = []
    for tx in transactions:
        u = user_map.get(tx['userId'])
        result.append({
            'id': str(tx['_id']),
            'userId': str(tx['userId']),
            'userName': u.get('name', 'Unknown') if u else 'Unknown',
            'userEmail': u.get('email', 'Unknown') if u else 'Unknown',
            'type': tx.get('type', ''),
            'amount': tx.get('amount', 0),
            'description': tx.get('description', ''),
            'balanceAfter': tx.get('balanceAfter', 0),
            'createdAt': tx.get('createdAt')
        })

    return {
        'transactions': result,
        'total': total,
        'page': page,
        'pages': (total + limit - 1) // limit
    }

@router.get("/admin/finance/transactions/export")
async def admin_finance_transactions_export(
    request: Request,
    search: str = None,
    type: str = None,
    from_: str = None,
    to: str = None
):
    from middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    query = {}
    if type and type != 'all':
        query['type'] = type
    if from_ or to:
        created = {}
        try:
            if from_:
                created['$gte'] = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        try:
            if to:
                created['$lte'] = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
        except Exception:
            pass
        if created:
            query['createdAt'] = created
    if search:
        users = await db.users.find({'email': {'$regex': search, '$options': 'i'}}, {'_id': 1}).to_list(2000)
        query['userId'] = {'$in': [u['_id'] for u in users]} if users else {'$in': []}

    transactions = await db.transactions.find(query).sort('createdAt', -1).to_list(50000)
    user_ids = list({tx['userId'] for tx in transactions if tx.get('userId')})
    users = await db.users.find({'_id': {'$in': user_ids}}, {'email': 1}).to_list(len(user_ids) or 1)
    user_email = {u['_id']: u.get('email', '') for u in users}

    def _iter_csv():
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['ID', 'User Email', 'Type', 'Amount', 'Description', 'Balance After', 'Date'])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for tx in transactions:
            writer.writerow([
                str(tx['_id']),
                user_email.get(tx.get('userId'), ''),
                tx.get('type', ''),
                tx.get('amount', 0),
                tx.get('description', ''),
                tx.get('balanceAfter', 0),
                tx.get('createdAt').isoformat() if tx.get('createdAt') else '',
            ])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"transactions_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(_iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})

@router.get("/admin/finance/revenue")
async def admin_finance_revenue(request: Request, from_: str = None, to: str = None):
    from middleware.admin import get_current_admin, require_admin_role
    admin = await get_current_admin(request, db)
    require_admin_role(admin, {"superadmin", "manager"})

    start = None
    end = None
    try:
        if from_:
            start = datetime.fromisoformat(from_).replace(tzinfo=timezone.utc)
    except Exception:
        start = None
    try:
        if to:
            end = datetime.fromisoformat(to).replace(tzinfo=timezone.utc)
    except Exception:
        end = None

    order_query = {}
    user_query = {'role': {'$ne': 'admin'}}
    dep_query = {'status': 'credited'}
    if start or end:
        rng = {}
        if start:
            rng['$gte'] = start
        if end:
            rng['$lte'] = end
        order_query['createdAt'] = rng
        user_query['createdAt'] = rng
        dep_query['creditedAt'] = rng

    orders = await db.orders.find(order_query).to_list(50000)
    deposits = await db.crypto_payment_sessions.find(dep_query).to_list(50000)
    users = await db.users.find(user_query).to_list(50000)

    def day_key(dt: datetime):
        d = dt.astimezone(timezone.utc).date()
        return d.isoformat()

    by_day = {}
    for o in orders:
        dt = o.get('createdAt')
        if not dt:
            continue
        k = day_key(dt)
        row = by_day.setdefault(k, {'date': k, 'orders': 0, 'revenue': 0.0, 'newUsers': 0, 'deposits': 0.0})
        row['orders'] += 1
        row['revenue'] += float(o.get('charge', 0) or 0)

    for u in users:
        dt = u.get('createdAt')
        if not dt:
            continue
        k = day_key(dt)
        row = by_day.setdefault(k, {'date': k, 'orders': 0, 'revenue': 0.0, 'newUsers': 0, 'deposits': 0.0})
        row['newUsers'] += 1

    for d in deposits:
        dt = d.get('creditedAt') or d.get('confirmedAt') or d.get('createdAt')
        if not dt:
            continue
        k = day_key(dt)
        row = by_day.setdefault(k, {'date': k, 'orders': 0, 'revenue': 0.0, 'newUsers': 0, 'deposits': 0.0})
        amt = float(d.get('receivedAmount') or d.get('expectedAmount') or 0)
        row['deposits'] += amt

    rows = sorted(by_day.values(), key=lambda r: r['date'])
    total_revenue = round(sum(r['revenue'] for r in rows), 2)
    total_orders = sum(r['orders'] for r in rows)
    avg_order_value = round((total_revenue / total_orders) if total_orders else 0.0, 2)

    for r in rows:
        r['revenue'] = round(r['revenue'], 2)
        r['deposits'] = round(r['deposits'], 2)

    return {
        'summary': {
            'totalRevenue': total_revenue,
            'totalOrders': total_orders,
            'averageOrderValue': avg_order_value
        },
        'rows': rows
    }

@router.get("/admin/finance/revenue/export")
async def admin_finance_revenue_export(request: Request, from_: str = None, to: str = None):
    data = await admin_finance_revenue(request, from_=from_, to=to)

    def _iter_csv():
        import csv
        import io
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(['Date', 'Orders', 'Revenue', 'New Users', 'Deposits'])
        yield output.getvalue()
        output.seek(0)
        output.truncate(0)
        for r in data.get('rows', []):
            writer.writerow([r['date'], r['orders'], r['revenue'], r['newUsers'], r['deposits']])
            yield output.getvalue()
            output.seek(0)
            output.truncate(0)

    filename = f"revenue_{datetime.now(timezone.utc).date().isoformat()}.csv"
    return StreamingResponse(_iter_csv(), media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})
