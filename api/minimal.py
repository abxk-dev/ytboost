"""
Minimal test endpoint for Vercel Python runtime
"""
from fastapi import FastAPI

app = FastAPI()

@app.get("/api/test")
async def test():
    return {"status": "ok", "message": "Python runtime works"}
