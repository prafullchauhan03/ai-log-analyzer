"""
/ai/analysis      POST  – full system health analysis
/ai/anomalies     POST  – anomaly detection report
/ai/forecast      POST  – 1-hour trend forecast
/ai/alert-summary POST  – AI summary of current alert backlog
/ai/chat          POST  – free-form Q&A with system context
/ai/status        GET   – whether Groq is configured
"""
import logging
from concurrent.futures import ThreadPoolExecutor, as_completed

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import desc

from app.auth.dependencies import get_current_user
from app.database.database import get_db
from app.database.models import Alert
from app.config import GROQ_API_KEY, GROQ_MODEL
import app.services.elasticsearch_service as es_svc
import app.services.kafka_service as kafka_svc
import app.services.redis_service as redis_svc
import app.services.groq_service as groq_svc

router = APIRouter(prefix="/ai", tags=["AI Insights"])
logger = logging.getLogger(__name__)


# ── helpers ───────────────────────────────────────────────────────────────────

def _collect_metrics() -> dict:
    tasks = {
        "elasticsearch": es_svc.get_full_status,
        "kafka":         kafka_svc.get_full_status,
        "redis":         redis_svc.get_full_status,
    }
    results = {}
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {pool.submit(fn): name for name, fn in tasks.items()}
        for future in as_completed(futures):
            name = futures[future]
            try:
                results[name] = future.result()
            except Exception as exc:
                logger.warning("Metric collection failed for %s: %s", name, exc)
                results[name] = {"connected": False}

    kafka = results.get("kafka", {})
    redis = results.get("redis", {})
    es    = results.get("elasticsearch", {})

    lag_score    = min(1.0, kafka.get("total_lag", 0) / 50_000)
    mem_score    = min(1.0, redis.get("memory_pct", 0) / 100)
    shard_score  = min(1.0, es.get("unassigned_shards", 0) / 10)
    health_score = 0.4 if es.get("health") == "red" else (0.2 if es.get("health") == "yellow" else 0.0)
    results["ai_threat_score"] = round(
        (lag_score * 0.3) + (mem_score * 0.3) + (shard_score * 0.2) + (health_score * 0.2), 4
    )
    return results


def _get_open_alerts(db: Session) -> list[dict]:
    alerts = (
        db.query(Alert)
        .filter(Alert.status.in_(["open", "acknowledged"]))
        .order_by(desc(Alert.created_at))
        .limit(20)
        .all()
    )
    return [
        {"title": a.title, "message": a.message,
         "severity": a.severity, "status": a.status,
         "category": a.category, "source": a.source}
        for a in alerts
    ]


# ── request models ────────────────────────────────────────────────────────────

class ChatRequest(BaseModel):
    question: str
    history:  list[dict] = []


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("/status")
def ai_status(user=Depends(get_current_user)):
    return {
        "available":  bool(GROQ_API_KEY),
        "model":      GROQ_MODEL if GROQ_API_KEY else None,
        "configured": bool(GROQ_API_KEY),
        "message":    "Groq AI ready" if GROQ_API_KEY else "Set GROQ_API_KEY in .env to enable AI features",
    }


@router.post("/analysis")
def system_analysis(
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user),
):
    """Full AI system health analysis."""
    metrics = _collect_metrics()
    return groq_svc.generate_system_analysis(metrics)


@router.post("/anomalies")
def anomaly_detection(
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user),
):
    """AI anomaly detection across all services."""
    metrics = _collect_metrics()
    return groq_svc.generate_anomaly_report(metrics)


@router.post("/alert-summary")
def alert_summary_ai(
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user),
):
    """AI-generated summary of the current alert backlog."""
    alerts = _get_open_alerts(db)
    return groq_svc.generate_alert_summary(alerts)


@router.post("/forecast")
def trend_forecast(
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user),
):
    """AI trend forecast for the next 1 hour."""
    metrics    = _collect_metrics()
    time_series = es_svc.get_log_volume_time_series(minutes=60) if metrics.get("elasticsearch", {}).get("connected") else []
    return groq_svc.generate_forecast(metrics, time_series)


@router.post("/chat")
def ai_chat(
    body: ChatRequest,
    db:   Session = Depends(get_db),
    user           = Depends(get_current_user),
):
    """Free-form Q&A about the system with live metric context."""
    if not body.question.strip():
        raise HTTPException(400, "Question cannot be empty")
    metrics = _collect_metrics()
    alerts  = _get_open_alerts(db)
    return groq_svc.chat_with_context(body.question, metrics, alerts, body.history)
