"""
Vercel Serverless Function entry point for YTBoost API.
This file exports the FastAPI ASGI app for Vercel's Python runtime.
"""

import sys
from pathlib import Path

# Add project root to Python path
ROOT_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(ROOT_DIR))

# Import the FastAPI app
from backend.server import app

# Vercel expects the ASGI app to be named 'app'
# The app is already created in backend.server
