"""
/alerts               GET  – paginated alert list with filters
/alerts/summary       GET  – open count by severity (sidebar badge)
/alerts/detect        POST – run detection now, return new alerts
/alerts/{id}          GET  – single alert detail
/alerts/{id}/acknowledge  PATCH – mark acknowledged
/alerts/{id}/resolve      PATCH – mark resolved
/alerts/{id}          DELETE – hard delete (admin)
"""
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from sqlalchemy import desc
from typing import Optional

from app.database.database import get_db
from app.database.models import Alert
from app.auth.dependencies import get_current_user
from app.alerts.engine import run_detection, get_alert_summary

router = APIRouter(prefix="/alerts", tags=["Alerts"])


# ── serialiser ────────────────────────────────────────────────────────────────

def _serialize(a: Alert) -> dict:
    return {
        "id":              a.id,
        "title":           a.title,
        "message":         a.message,
        "severity":        a.severity,
        "category":        a.category,
        "source":          a.source,
        "rule_id":         a.rule_id,
        "metric_key":      a.metric_key,
        "metric_value":    a.metric_value,
        "threshold":       a.threshold,
        "status":          a.status,
        "acknowledged_by": a.acknowledged_by,
        "resolved_by":     a.resolved_by,
        "created_at":      a.created_at.isoformat() if a.created_at else None,
        "updated_at":      a.updated_at.isoformat() if a.updated_at else None,
    }


# ── routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_alerts(
    severity: Optional[str] = Query(None, description="Filter: critical|high|medium|low"),
    status:   Optional[str] = Query(None, description="Filter: open|acknowledged|resolved"),
    category: Optional[str] = Query(None, description="Filter: security|performance|infrastructure|anomaly"),
    source:   Optional[str] = Query(None),
    limit:    int           = Query(50,  ge=1, le=200),
    offset:   int           = Query(0,   ge=0),
    db: Session = Depends(get_db),
    user      = Depends(get_current_user),
):
    q = db.query(Alert)
    if severity: q = q.filter(Alert.severity == severity)
    if status:   q = q.filter(Alert.status   == status)
    if category: q = q.filter(Alert.category == category)
    if source:   q = q.filter(Alert.source   == source)

    total = q.count()
    alerts = q.order_by(desc(Alert.created_at)).offset(offset).limit(limit).all()
    return {
        "total":  total,
        "offset": offset,
        "limit":  limit,
        "alerts": [_serialize(a) for a in alerts],
    }


@router.get("/summary")
def alert_summary(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user),
):
    return get_alert_summary(db)


@router.post("/detect")
def trigger_detection(
    db: Session = Depends(get_db),
    user        = Depends(get_current_user),
):
    """Run the detection engine immediately. Returns newly created alerts."""
    new_alerts = run_detection(db)
    return {
        "detected": len(new_alerts),
        "alerts":   [_serialize(a) for a in new_alerts],
    }


@router.get("/{alert_id}")
def get_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user        = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    return _serialize(alert)


@router.patch("/{alert_id}/acknowledge")
def acknowledge_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user        = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    if alert.status == "resolved":
        raise HTTPException(400, "Cannot acknowledge a resolved alert")

    alert.status          = "acknowledged"
    alert.acknowledged_by = user.get("username", user.get("sub", "unknown"))
    db.commit()
    db.refresh(alert)
    return _serialize(alert)


@router.patch("/{alert_id}/resolve")
def resolve_alert(
    alert_id: int,
    db: Session = Depends(get_db),
    user        = Depends(get_current_user),
):
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")

    alert.status      = "resolved"
    alert.resolved_by = user.get("username", user.get("sub", "unknown"))
    db.commit()
    db.refresh(alert)
    return _serialize(alert)


@router.delete("/{alert_id}")
def delete_alert(
    alert_id: int,
    db: Session  = Depends(get_db),
    user         = Depends(get_current_user),
):
    if user.get("role") != "admin":
        raise HTTPException(403, "Admin only")
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(404, "Alert not found")
    db.delete(alert)
    db.commit()
    return {"deleted": alert_id}
