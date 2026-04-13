"""
YTBoost.io - YouTube SMM Panel
Main Server File with Socket.io for Real-time Updates
"""

from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
import certifi
from pymongo.errors import PyMongoError

# ✅ FIXED IMPORTS (CRITICAL)
from backend.routes import (
    auth, admin_auth, categories, services, orders, crypto,
    users, transactions, settings, apiv2, api_providers,
    support, system, communications
)

from backend.services.blockchain_scheduler import (
    start_blockchain_scheduler,
    stop_blockchain_scheduler
)

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ytboost')

mongo_client_kwargs = {}

if mongo_url.startswith("mongodb+srv://") or "mongodb.net" in mongo_url:
    mongo_client_kwargs["tlsCAFile"] = certifi.where()

client = AsyncIOMotorClient(mongo_url, **mongo_client_kwargs)
db = client[db_name]

# CORS
origins = [
    "http://localhost:3000",
    "http://localhost:5173",
]

# Socket.io
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins=origins
)

app = FastAPI()

socket_app = socketio.ASGIApp(sio, app)

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Uploads
UPLOAD_DIR = "./uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Attach DB
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

# Routes
# Routes
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
app.include_router(api_providers.router, prefix="/api")
app.include_router(support.router, prefix="/api")
app.include_router(system.router, prefix="/api")
app.include_router(communications.router, prefix="/api")

@app.get("/api")
async def root():
    return {"message": "YTBoost API"}

# Startup
@app.on_event("startup")
async def startup():
    logger.info("Starting server...")
    try:
        await db.command("ping")
        start_blockchain_scheduler(db, sio)
        logger.info("Server started successfully")
    except Exception as e:
        logger.error(f"Startup error: {e}")

# Shutdown
@app.on_event("shutdown")
async def shutdown():
    stop_blockchain_scheduler()
    client.close()

# ✅ IMPORTANT EXPORT
application = socket_app

# ✅ FIXED RUN COMMAND
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.server:application", host="0.0.0.0", port=8000)