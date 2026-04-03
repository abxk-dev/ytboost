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
from fastapi.responses import FileResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging

# Import routes
from routes import auth, admin_auth, categories, services, orders, crypto, users, transactions, settings, apiv2

# Import services
from services.blockchain_scheduler import start_blockchain_scheduler, stop_blockchain_scheduler

# MongoDB connection
mongo_url = os.environ.get('MONGO_URL', 'mongodb://localhost:27017')
db_name = os.environ.get('DB_NAME', 'ytboost')
client = AsyncIOMotorClient(mongo_url)
db = client[db_name]

# Create Socket.io server
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Create FastAPI app
app = FastAPI(
    title="YTBoost.io API",
    description="YouTube SMM Panel with BEP20 Crypto Payments",
    version="1.0.0"
)

# Socket.io ASGI app
socket_app = socketio.ASGIApp(sio, app)

# CORS middleware
frontend_url = os.environ.get('CORS_ORIGINS', '*')
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=frontend_url.split(',') if frontend_url != '*' else ['*'],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Ensure uploads directory exists
UPLOAD_DIR = os.environ.get('UPLOAD_DIR', './uploads')
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount uploads directory
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

# Set database for all routes
auth.set_db(db)
admin_auth.set_db(db)
categories.set_db(db)
services.set_db(db)
orders.set_db(db)
crypto.set_db(db)
crypto.set_socket_manager(sio)
users.set_db(db)
users.set_socket_manager(sio)
transactions.set_db(db)
settings.set_db(db)
apiv2.set_db(db)

# Include all routers with /api prefix
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

# Root endpoint
@app.get("/api")
async def root():
    return {"message": "YTBoost.io API", "version": "1.0.0"}

@app.get("/api/health")
async def health_check():
    return {"status": "healthy"}

# Socket.io event handlers
@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join_payment_session(sid, session_id):
    """Join a payment session room for real-time updates"""
    room = f"payment-session-{session_id}"
    await sio.enter_room(sid, room)
    logger.info(f"Client {sid} joined room {room}")

@sio.event
async def leave_payment_session(sid, session_id):
    """Leave a payment session room"""
    room = f"payment-session-{session_id}"
    await sio.leave_room(sid, room)
    logger.info(f"Client {sid} left room {room}")

@sio.event
async def join_user_room(sid, user_id):
    """Join user's personal room for balance updates"""
    room = f"user-{user_id}"
    await sio.enter_room(sid, room)
    logger.info(f"Client {sid} joined user room {room}")

@sio.event
async def leave_user_room(sid, user_id):
    """Leave user's personal room"""
    room = f"user-{user_id}"
    await sio.leave_room(sid, room)

# Startup event
@app.on_event("startup")
async def startup_event():
    logger.info("🚀 Starting YTBoost.io server...")
    
    # Seed database
    from seed import seed_database
    await seed_database(db)
    
    # Start blockchain scheduler
    start_blockchain_scheduler(db, sio)
    
    logger.info("✅ YTBoost.io server started successfully!")

# Shutdown event
@app.on_event("shutdown")
async def shutdown_event():
    logger.info("Shutting down YTBoost.io server...")
    stop_blockchain_scheduler()
    client.close()
    logger.info("Server shutdown complete")

# Export the socket app for uvicorn
application = socket_app
