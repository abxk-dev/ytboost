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

# Public routes
@router.get("/categories")
async def get_categories():
    """Get all active categories (public)"""
    categories = await db.categories.find({'status': True}, {'_id': 1, 'name': 1, 'slug': 1}).to_list(100)
    
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
    
    categories = await db.categories.find({}).to_list(100)
    
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
    
    category_doc = {
        'name': data.name,
        'slug': slug,
        'status': data.status,
        'createdAt': datetime.now(timezone.utc)
    }
    
    result = await db.categories.insert_one(category_doc)
    
    return {
        'id': str(result.inserted_id),
        'name': data.name,
        'slug': slug,
        'status': data.status
    }

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
async def admin_delete_category(request: Request, category_id: str):
    """Delete category (admin)"""
    from middleware.admin import get_current_admin
    await get_current_admin(request, db)
    
    try:
        obj_id = ObjectId(category_id)
    except:
        raise HTTPException(status_code=400, detail="Invalid category ID")
    
    # Check if category has services
    service_count = await db.services.count_documents({'categoryId': obj_id})
    if service_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete category with {service_count} services")
    
    result = await db.categories.delete_one({'_id': obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Category not found")
    
    return {'message': 'Category deleted successfully'}
