"""
Minimal test endpoint for Vercel Python runtime
"""
def handler(request, response):
    response.status_code = 200
    response.headers['Content-Type'] = 'application/json'
    return {"status": "ok", "message": "Python runtime works"}
