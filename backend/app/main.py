import logging
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database.database import Base, engine, SessionLocal
from app.auth.auth_routes        import router as auth_router
from app.routes.dashboard_routes import router as dashboard_router
from app.routes.infra_routes     import router as infra_router
from app.routes.websocket_routes import router as ws_router
from app.routes.ai_routes        import router as ai_router
from app.routes.user_routes      import router as user_router      # FIX: was imported as users_router
from app.routes.settings_routes  import router as settings_router
from app.alerts.alert_routes     import router as alerts_router
from app.alerts.engine           import run_detection

logger = logging.getLogger(__name__)
Base.metadata.create_all(bind=engine)


async def _detection_loop(interval: int = 60):
    await asyncio.sleep(15)
    while True:
        # FIX: use context manager so session always closes even if run_detection raises
        try:
            with SessionLocal() as db:
                new = run_detection(db)
                if new:
                    logger.info("Detection cycle: %d new alert(s)", len(new))
        except Exception as exc:
            logger.error("Detection loop error: %s", exc)
        await asyncio.sleep(interval)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(_detection_loop(60))
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="AI Log Analyzer Enterprise API",
    version="3.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://localhost:3000",
        # Production origins — update these after deployment
        "https://ai-log-analyzer-xi.vercel.app",
        
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dashboard_router)
app.include_router(infra_router)
app.include_router(alerts_router)
app.include_router(ai_router)
app.include_router(user_router)
app.include_router(settings_router)
app.include_router(ws_router)


@app.get("/")
def root():
    return {"message": "AI Log Analyzer Enterprise API", "status": "running", "version": "3.1.0"}
