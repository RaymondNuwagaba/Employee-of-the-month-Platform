from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.routers import admin, auth, employee

settings = get_settings()

app = FastAPI(title="Employee of the Month API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


@app.middleware("http")
async def csrf_guard(request: Request, call_next):
    """Cookie sessions + a required custom header: browsers will not let another site send it."""
    if request.method not in SAFE_METHODS and request.url.path.startswith("/api/"):
        if request.headers.get("x-requested-with") != "eotm":
            return JSONResponse({"detail": "Missing CSRF header"}, status_code=403)
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    return response


app.include_router(auth.router)
app.include_router(employee.router)
app.include_router(admin.router)


@app.get("/api/health")
def health():
    return {"status": "ok"}
