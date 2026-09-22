from fastapi import FastAPI

app = FastAPI(
    title="Dorm Management API",
    version="1.0.0"
)

@app.get("/")
async def root():
    return {
        "message": "Dorm Management API"
    }
    
@app.get("/health")
def health_check():
    """Basic health check for load balancers/uptime monitors."""
    return {"status": "ok"}