"""
YTBoost.io - YouTube SMM Panel
Serverless-compatible FastAPI server (no Socket.io, no APScheduler)
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import certifi

# Import route modules
from backend.routes import (
    auth, admin_auth, categories, services, orders, crypto,
    users, transactions, settings, apiv2, api_providers,
    support, system, communications, workflows
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# MongoDB connection (lazy initialization for serverless)
_client = None
_db = None

def get_db():
    global _client, _db
    if _db is None:
        mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
        db_name = os.environ.get('DB_NAME', 'ytboost')
        mongo_client_kwargs = {}
        if mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
            mongo_client_kwargs["tlsCAFile"] = certifi.where()
        _client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
        _db = _client[db_name]
    return _db

# CORS configuration
_cors_env = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173")
origins = [o.strip() for o in _cors_env.split(",") if o.strip() and o.strip() != "*"]
_cors_regex = os.environ.get("CORS_ORIGIN_REGEX", "https?://.+").strip()
if _cors_regex.lower() in ("", "none", "false"):
    _cors_regex = None

# Create FastAPI app
app = FastAPI(title="YTBoost API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_origin_regex=_cors_regex,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Attach DB to all route modules
def attach_db():
    db = get_db()
    auth.set_db(db)
    admin_auth.set_db(db)
    categories.set_db(db)
    services.set_db(db)
    orders.set_db(db)
    crypto.set_db(db)
    users.set_db(db)
    transactions.set_db(db)
    settings.set_db(db)
    apiv2.set_db(db)
    api_providers.set_db(db)
    support.set_db(db)
    system.set_db(db)
    communications.set_db(db)
    workflows.set_db(db)

# Include routers
app.include_router(auth.router, prefix="/api")
app.include_router(admin_auth.router, prefix="/api")
app.include_router(categories.router, prefix="/api")
app.include_router(services.router, prefix="/api")
app.include_router(orders.router, prefix="/api")
app.include_router(crypto.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(transactions.router, prefix="/api")
app.include_router(settings.router, prefix="/api")
app.include_router(apiv2.router, prefix="/api")
app.include_router(apiv2.router, prefix="")  # JAP compatibility
app.include_router(api_providers.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(communications.router, prefix="/api")
app.include_router(workflows.router, prefix="/api")

@app.get("/api")
async def root():
    return {"message": "YTBoost API"}

@app.get("/api/health")
async def public_health():
    try:
        db = get_db()
        await db.command("ping")
        return {"status": "healthy", "db": "ok"}
    except Exception as e:
        return JSONResponse(
            status_code=503,
            content={"status": "unhealthy", "detail": str(e)},
        )

# Middleware to ensure DB is attached on first request
@app.middleware("http")
async def ensure_db(request, call_next):
    if _db is None:
        attach_db()
    response = await call_next(request)
    return response

# For local development
if __name__ == "__main__":
    import uvicorn
    attach_db()
    uvicorn.run("backend.server:app", host="0.0.0.0", port=8000)
