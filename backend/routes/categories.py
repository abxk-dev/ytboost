"""
Categories Routes - CRUD for service categories
"""
from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, Field
from datetime import datetime, timezone
from bson import ObjectId
import re

router = APIRouter(tags=["Categories"])

# Request models
class CategoryCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=100)
    slug: str = ""
    status: bool = True

class CategoryUpdate(BaseModel):
    name: str = Field(None, min_length=1, max_length=100)
    slug: str = None
    status: bool = None

class CategoryReorder(BaseModel):
    categoryIds: list[str] = []

# Dependency injection placeholder
db = None

def set_db(database):
    global db
    db = database

def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[\s_-]+', '-', text)
    return text.strip('-')

async def _get_or_create_uncategorized():
    slug = "uncategorized"
    existing = await db.categories.find_one({"slug": slug})
    if existing:
        return existing["_id"]
    await _ensure_category_orders()
    max_doc = await db.categories.find({}, {"order": 1}).sort("order", -1).limit(1).to_list(1)
    next_order = int(max_doc[0].get("order", 0)) + 1 if max_doc else 1
    doc = {
        "name": "UNCATEGORIZED",
        "slug": slug,
        "status": False,
        "order": next_order,
        "createdAt": datetime.now(timezone.utc),
    }
    res = await db.categories.insert_one(doc)
    return res.inserted_id

async def _ensure_category_orders():
    missing = await db.categories.find(
        {'$or': [{'order': {'$exists': False}}, {'order': None}]},
        {'_id': 1, 'createdAt': 1}
    ).sort('createdAt', 1).to_list(500)
    if not missing:
        return

    max_doc = await db.categories.find({'order': {'$exists': True, '$ne': None}}, {'order': 1}).sort('order', -1).limit(1).to_list(1)
    start = int(max_doc[0].get('order', 0)) + 1 if max_doc else 1
    for idx, cat in enumerate(missing):
        await db.categories.update_one({'_id': cat['_id']}, {'$set': {'order': start + idx}})

# Public routes
@router.get("/categories")
async def get_categories():
    """Get all active categories (public)"""
    await _ensure_category_orders()
    categories = await db.categories.find(
        {'status': True},
        {'_id': 1, 'name': 1, 'slug': 1}
    ).sort([('order', 1), ('createdAt', 1)]).to_list(1000)
    
    for cat in categories:
        cat['id'] = str(cat['_id'])
        del cat['_id']
    
    return categories

# Admin routes
@router.get("/admin/categories")
async def admin_get_categories(request: Request):
    """Get all categories with service count (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    await _ensure_category_orders()
    categories = await db.categories.find({}).sort([('order', 1), ('createdAt', 1)]).to_list(1000)
    
    result = []
    for cat in categories:
        # Get service count
        service_count = await db.services.count_documents({'categoryId': cat['_id']})
        result.append({
            'id': str(cat['_id']),
            'name': cat['name'],
            'slug': cat['slug'],
            'status': cat.get('status', True),
            'servicesCount': service_count,
            'order': cat.get('order'),
            'createdAt': cat.get('createdAt')
        })
    
    return result

@router.post("/admin/categories")
async def admin_create_category(request: Request, data: CategoryCreate):
    """Create new category (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    slug = data.slug.strip() if data.slug else slugify(data.name)
    
    # Check uniqueness
    existing = await db.categories.find_one({'$or': [{'name': data.name}, {'slug': slug}]})
    if existing:
        raise HTTPException(status_code=400, detail="Category name already exists")

    await _ensure_category_orders()
    max_doc = await db.categories.find({}, {'order': 1}).sort('order', -1).limit(1).to_list(1)
    next_order = int(max_doc[0].get('order', 0)) + 1 if max_doc else 1
    
    category_doc = {
        'name': data.name,
        'slug': slug,
        'status': data.status,
        'order': next_order,
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.categories.insert_one(category_doc)
    
    return {
        'id': str(result.inserted_id),
        'name': data.name,
        'slug': slug,
        'status': data.status
    }

@router.put("/admin/categories/reorder")
async def admin_reorder_categories(request: Request, data: CategoryReorder):
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    if not data.categoryIds:
        raise HTTPException(status_code=400, detail="No categories provided")

    ids = []
    seen = set()
    for cid in data.categoryIds:
        if cid in seen:
            raise HTTPException(status_code=400, detail="Duplicate category id")
        seen.add(cid)
        try:
            ids.append(ObjectId(cid))
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid category ID")

    total = await db.categories.count_documents({})
    if total != len(ids):
        raise HTTPException(status_code=400, detail="Category list must include all categories")

    for idx, obj_id in enumerate(ids):
        await db.categories.update_one({'_id': obj_id}, {'$set': {'order': idx + 1}})

    return {'message': 'Category order updated'}

@router.put("/admin/categories/{category_id}")
async def admin_update_category(request: Request, category_id: str, data: CategoryUpdate):
    """Update category (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(category_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    category = await db.categories.find_one({'_id': obj_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    
    update_data = {}
    if data.name is not None:
        update_data['name'] = data.name
        update_data['slug'] = data.slug.strip() if data.slug else slugify(data.name)
        
        # Check uniqueness
        existing = await db.categories.find_one({
            '$or': [{'name': data.name}, {'slug': update_data['slug']}],
            '_id': {'$ne': obj_id}
        })
        if existing:
            raise HTTPException(status_code=400, detail="Category name already exists")
    
    if data.status is not None:
        update_data['status'] = data.status
    
    if update_data:
        await db.categories.update_one({'_id': obj_id}, {'$set': update_data})
    
    updated = await db.categories.find_one({'_id': obj_id})
    return {
        'id': str(updated['_id']),
        'name': updated['name'],
        'slug': updated['slug'],
        'status': updated.get('status', True)
    }

@router.delete("/admin/categories/{category_id}")
async def admin_delete_category(request: Request, category_id: str, force: bool = False):
    """Delete category (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(category_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid category ID")

    category = await db.categories.find_one({'_id': obj_id})
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    if category.get("slug") == "uncategorized":
        raise HTTPException(status_code=400, detail="Cannot delete Uncategorized category")
    
    # Check if category has services
    service_count = await db.services.count_documents({'categoryId': obj_id})
    if service_count > 0:
        if not force:
            raise HTTPException(status_code=400, detail=f"Cannot delete category with {service_count} services")
        uncat_id = await _get_or_create_uncategorized()
        await db.services.update_many(
            {'categoryId': obj_id},
            {'$set': {'categoryId': uncat_id, 'status': False}}
        )
    
    result = await db.categories.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {'message': 'Category deleted successfully'}
