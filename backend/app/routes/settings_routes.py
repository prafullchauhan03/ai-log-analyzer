"""
Settings routes — system configuration readable/writable via the API.
Settings are stored as environment-aware values; writes go to a JSON sidecar
file (settings.json) that overrides defaults at runtime.

GET  /settings          — all settings (current effective values)
PUT  /settings          — update one or more settings (admin only)
POST /settings/test-es  — test Elasticsearch connection
POST /settings/test-kafka  — test Kafka connection
POST /settings/test-redis  — test Redis connection
POST /settings/reset    — reset to defaults (admin only)
"""
import json
import os
import logging
from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.auth.dependencies import get_current_user, require_admin

router  = APIRouter(prefix="/settings", tags=["Settings"])
logger  = logging.getLogger(__name__)

_SETTINGS_FILE = Path(__file__).parent.parent / "settings.json"

_DEFAULTS = {
    "es_host":             os.getenv("ES_HOST",             "http://localhost:9200"),
    "es_index":            os.getenv("ES_INDEX",            "logs-*"),
    "es_timeout":          int(os.getenv("ES_TIMEOUT",      "2")),
    "kafka_brokers":       os.getenv("KAFKA_BROKERS",       "localhost:9092"),
    "kafka_consumer_group":os.getenv("KAFKA_CONSUMER_GROUP","log-consumers"),
    "kafka_topics":        os.getenv("KAFKA_TOPICS",        "logs-raw,logs-processed,logs-alerts"),
    "kafka_timeout":       int(os.getenv("KAFKA_TIMEOUT",   "2")),
    "redis_host":          os.getenv("REDIS_HOST",          "localhost"),
    "redis_port":          int(os.getenv("REDIS_PORT",      "6379")),
    "redis_db":            int(os.getenv("REDIS_DB",        "0")),
    "redis_timeout":       int(os.getenv("REDIS_TIMEOUT",   "2")),
    "groq_model":          os.getenv("GROQ_MODEL",          "llama-3.3-70b-versatile"),
    "alert_dedup_minutes": 30,
    "alert_detection_interval_s": 60,
    "dashboard_refresh_s": 30,
    "log_stream_max_entries": 200,
}


def _load() -> dict:
    try:
        if _SETTINGS_FILE.exists():
            with open(_SETTINGS_FILE) as f:
                overrides = json.load(f)
            return {**_DEFAULTS, **overrides}
    except Exception as exc:
        logger.warning("Could not load settings.json: %s", exc)
    return dict(_DEFAULTS)


def _save(data: dict):
    try:
        with open(_SETTINGS_FILE, "w") as f:
            json.dump(data, f, indent=2)
    except Exception as exc:
        logger.error("Could not save settings.json: %s", exc)
        raise HTTPException(500, f"Failed to save settings: {exc}")


class SettingsUpdate(BaseModel):
    es_host:              Optional[str] = None
    es_index:             Optional[str] = None
    es_timeout:           Optional[int] = None
    kafka_brokers:        Optional[str] = None
    kafka_consumer_group: Optional[str] = None
    kafka_topics:         Optional[str] = None
    kafka_timeout:        Optional[int] = None
    redis_host:           Optional[str] = None
    redis_port:           Optional[int] = None
    redis_db:             Optional[int] = None
    redis_timeout:        Optional[int] = None
    groq_model:           Optional[str] = None
    alert_dedup_minutes:  Optional[int] = None
    alert_detection_interval_s: Optional[int] = None
    dashboard_refresh_s:  Optional[int] = None
    log_stream_max_entries: Optional[int] = None


@router.get("")
def get_settings(user = Depends(get_current_user)):
    settings = _load()
    # Never expose secrets
    settings.pop("groq_api_key", None)
    settings["groq_api_key_set"] = bool(os.getenv("GROQ_API_KEY", ""))
    settings["es_password_set"]  = bool(os.getenv("ES_PASSWORD",  ""))
    settings["redis_password_set"] = bool(os.getenv("REDIS_PASSWORD", ""))
    return settings


@router.put("")
def update_settings(
    body: SettingsUpdate,
    user  = Depends(require_admin),
):
    current = _load()
    updates = {k: v for k, v in body.model_dump().items() if v is not None}
    current.update(updates)
    _save(current)

    # Reset service availability caches so new settings take effect immediately
    try:
        import app.services.elasticsearch_service as es_svc
        import app.services.kafka_service         as kafka_svc
        import app.services.redis_service         as redis_svc
        es_svc._reset()
        kafka_svc._reset_availability()
        redis_svc._reset()
    except Exception:
        pass

    return {"message": "Settings saved", "updated": list(updates.keys())}


@router.post("/test-es")
def test_elasticsearch(user = Depends(get_current_user)):
    try:
        import app.services.elasticsearch_service as es_svc
        es_svc._reset()
        ok = es_svc._ping()
        return {"success": ok, "message": "Connected" if ok else "Not reachable"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/test-kafka")
def test_kafka(user = Depends(get_current_user)):
    try:
        import app.services.kafka_service as kafka_svc
        kafka_svc._reset_availability()
        ok = kafka_svc._try_connect()
        return {"success": ok, "message": "Connected" if ok else "Not reachable"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/test-redis")
def test_redis(user = Depends(get_current_user)):
    try:
        import app.services.redis_service as redis_svc
        redis_svc._reset()
        ok = redis_svc._ping()
        return {"success": ok, "message": "Connected" if ok else "Not reachable"}
    except Exception as exc:
        return {"success": False, "message": str(exc)}


@router.post("/reset")
def reset_settings(user = Depends(require_admin)):
    if _SETTINGS_FILE.exists():
        _SETTINGS_FILE.unlink()
    return {"message": "Settings reset to defaults"}
