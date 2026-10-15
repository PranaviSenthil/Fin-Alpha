import os
import asyncio
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from app.core.config import settings
from app.core.database import init_db, seed_master_data
from app.market_data.scheduler import start_market_scheduler
from app.core.utils import SafeJSONResponse
from app.api.v1.auth import router as auth_router
from app.api.v1.users import router as users_router
from app.api.v1.stocks import router as stocks_router
from app.api.v1.market import router as market_router
from app.api.v1.watchlists import router as watchlists_router
from app.api.v1.trading import router as trading_router
from app.api.v1.portfolio import router as portfolio_router
from app.api.v1.ai import router as ai_router

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")
logger = logging.getLogger("vibefinance")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing VibeFinance Database & Master Seeding...")
    init_db()
    seed_master_data()
    logger.info("Database and curated 100 stock universe ready.")

    # Start 5-minute background market refresh scheduler
    scheduler_task = asyncio.create_task(start_market_scheduler())
    
    yield

    logger.info("Shutting down VibeFinance...")
    scheduler_task.cancel()
    try:
        await scheduler_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="VibeFinance — Indian Stock Market & AI Investment Intelligence Platform",
    description="""
    Institutional-grade Indian stock market intelligence and simulated paper-trading platform.
    Features:
    - 100 premier Indian equities across 10 distinct sectors.
    - Automated market quote refresh cadence and verifiable data freshness status.
    - Simulated paper-trading engine with virtual starting funds (₹10,00,000), double-entry cash ledger, and weighted cost accounting.
    - Interactive technical charting and indicators (SMA, EMA, RSI, MACD, Bollinger Bands).
    - AI-powered macro market pulse, company deep research, portfolio concentration risk audit, and behavioral trading analytics.
    """,
    version=settings.VERSION,
    lifespan=lifespan,
    default_response_class=SafeJSONResponse
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount API routers under /api/v1
app.include_router(auth_router, prefix=settings.API_V1_STR)
app.include_router(users_router, prefix=settings.API_V1_STR)
app.include_router(stocks_router, prefix=settings.API_V1_STR)
app.include_router(market_router, prefix=settings.API_V1_STR)
app.include_router(watchlists_router, prefix=settings.API_V1_STR)
app.include_router(trading_router, prefix=settings.API_V1_STR)
app.include_router(portfolio_router, prefix=settings.API_V1_STR)
app.include_router(ai_router, prefix=settings.API_V1_STR)

@app.get("/health")
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "mode": "Simulated Paper Trading & Market Intelligence"
    }

# Detect frontend static build directory for unified deployment
FRONTEND_DIST_CANDIDATES = [
    os.getenv("FRONTEND_DIST_DIR"),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "frontend_dist")),
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist")),
]

dist_dir = None
for candidate in FRONTEND_DIST_CANDIDATES:
    if candidate and os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "index.html")):
        dist_dir = candidate
        break

if dist_dir:
    logger.info(f"Serving frontend static build from: {dist_dir}")
    assets_dir = os.path.join(dist_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

    @app.get("/")
    async def serve_root_spa():
        return FileResponse(os.path.join(dist_dir, "index.html"))

    @app.get("/{full_path:path}")
    async def serve_spa_or_file(full_path: str):
        # Exclude API endpoints and OpenAPI docs from SPA fallback
        if (
            full_path.startswith("api/")
            or full_path == "api"
            or full_path.startswith("docs")
            or full_path.startswith("redoc")
            or full_path.startswith("openapi.json")
            or full_path == "health"
        ):
            raise HTTPException(status_code=404, detail="Not Found")

        target_file = os.path.join(dist_dir, full_path)
        if full_path and os.path.isfile(target_file):
            return FileResponse(target_file)
        return FileResponse(os.path.join(dist_dir, "index.html"))
else:
    @app.get("/")
    def root():
        return {
            "service": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "online",
            "message": "VibeFinance Backend API is operational.",
            "frontend_app": "http://localhost:5173",
            "api_documentation": "/docs",
            "health_check": "/health"
        }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
