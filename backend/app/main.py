from fastapi import FastAPI

app = FastAPI(
    title="Room Management API",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {
        "message": "Room Management API"
    }
    
@app.get("/health")
def health_check():
    """Basic health check for load balancers/uptime monitors."""
    return {"status": "ok"}