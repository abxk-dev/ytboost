"""
Vercel Serverless Function entry point for YTBoost API.
This file exports the FastAPI ASGI app for Vercel's Python runtime.
"""

import sys
from pathlib import Path
import traceback

# Add project root to Python path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

try:
    # Import the FastAPI app
    from backend.server import app
except Exception as e:
    print(f"IMPORT ERROR: {e}")
    traceback.print_exc()
    
    from fastapi import FastAPI
    app = FastAPI()
    
    @app.get("/api/health")
    async def health():
        return {"status": "error", "detail": str(e)}
    
    raise

# Explicitly export for Vercel
__all__ = ['app']
