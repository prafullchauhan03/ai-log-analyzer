"""
Alert engine — wires the rules evaluator to the database.

  run_detection(db)  → collects live metrics, runs rules, persists new alerts,
                        returns list of newly created Alert rows.
"""
import logging
from datetime import datetime, timedelta, timezone
from concurrent.futures import ThreadPoolExecutor, as_completed

from sqlalchemy.orm import Session

from app.database.models import Alert
from app.alerts.rules import evaluate_rules
import app.services.elasticsearch_service as es_svc
import app.services.kafka_service as kafka_svc
import app.services.redis_service as redis_svc

logger = logging.getLogger(__name__)

# How long to suppress a duplicate alert after it first fires (minutes)
DEDUP_WINDOW_MINUTES = 30


# ── metric collection ──────────────────────────────────────────────────────────

def _collect_metrics() -> dict:
    """Fetch all service metrics concurrently. Each service is fault-isolated."""
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

    # Derive AI threat score from real signals
    kafka = results.get("kafka", {})
    redis = results.get("redis", {})
    es    = results.get("elasticsearch", {})

    lag_score    = min(1.0, kafka.get("total_lag", 0)    / 50_000)
    mem_score    = min(1.0, redis.get("memory_pct", 0)   / 100)
    shard_score  = min(1.0, es.get("unassigned_shards", 0) / 10)
    health_score = 0.4 if es.get("health") == "red" else (0.2 if es.get("health") == "yellow" else 0.0)

    results["ai_threat_score"] = round(
        (lag_score * 0.3) + (mem_score * 0.3) + (shard_score * 0.2) + (health_score * 0.2),
        4,
    )

    return results


# ── deduplication ──────────────────────────────────────────────────────────────

def _is_duplicate(db: Session, rule_id: str) -> bool:
    """Returns True if an open/acknowledged alert for this rule fired recently."""
    cutoff = datetime.now(timezone.utc) - timedelta(minutes=DEDUP_WINDOW_MINUTES)
    existing = (
        db.query(Alert)
        .filter(
            Alert.rule_id == rule_id,
            Alert.status.in_(["open", "acknowledged"]),
            Alert.created_at >= cutoff,
        )
        .first()
    )
    return existing is not None


# ── public API ─────────────────────────────────────────────────────────────────

def run_detection(db: Session) -> list[Alert]:
    """Collect metrics → evaluate rules → persist new alerts → return them."""
    try:
        metrics = _collect_metrics()
    except Exception as exc:
        logger.error("Metric collection error: %s", exc)
        return []

    fired = evaluate_rules(metrics)
    new_alerts = []

    for item in fired:
        if _is_duplicate(db, item["rule_id"]):
            logger.debug("Suppressed duplicate alert: %s", item["rule_id"])
            continue

        alert = Alert(
            title        = item["title"],
            message      = item["message"],
            severity     = item["severity"],
            category     = item["category"],
            source       = item["source"],
            rule_id      = item["rule_id"],
            metric_key   = item["metric_key"],
            metric_value = item["metric_value"],
            threshold    = item["threshold"],
            status       = "open",
        )
        db.add(alert)
        new_alerts.append(alert)
        logger.info("New alert: [%s] %s", item["severity"].upper(), item["title"])

    if new_alerts:
        db.commit()
        for a in new_alerts:
            db.refresh(a)

    return new_alerts


def get_alert_summary(db: Session) -> dict:
    """Counts by severity and status — used for the sidebar badge."""
    from sqlalchemy import func
    rows = (
        db.query(Alert.severity, Alert.status, func.count(Alert.id))
        .group_by(Alert.severity, Alert.status)
        .all()
    )
    open_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
    for severity, status, count in rows:
        if status in ("open", "acknowledged"):
            open_counts[severity] = open_counts.get(severity, 0) + count

    return {
        "open_total":   sum(open_counts.values()),
        "by_severity":  open_counts,
    }
