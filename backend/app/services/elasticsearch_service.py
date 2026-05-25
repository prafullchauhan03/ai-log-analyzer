"""
Elasticsearch service — cluster health, index stats, log volume time series.
Falls back to mock data instantly if ES is unreachable (cached after first check).
"""
import logging
import random
from datetime import datetime, timedelta, timezone
from typing import Any

from app.config import (
    ES_HOST, ES_USERNAME, ES_PASSWORD, ES_API_KEY,
    ES_INDEX, ES_TIMEOUT
)

logger = logging.getLogger(__name__)

_client        = None
_es_available  = None   # None=untested, True/False cached


def get_client():
    global _client
    if _client is not None:
        return _client
    try:
        from elasticsearch import Elasticsearch
        kwargs: dict[str, Any] = {
            "hosts": [ES_HOST],
            "request_timeout": ES_TIMEOUT,
            "retry_on_timeout": False,
            "max_retries": 0,
        }
        if ES_API_KEY:
            kwargs["api_key"] = ES_API_KEY
        elif ES_USERNAME and ES_PASSWORD:
            kwargs["basic_auth"] = (ES_USERNAME, ES_PASSWORD)
        _client = Elasticsearch(**kwargs)
    except Exception as exc:
        logger.debug("ES client init error: %s", exc)
    return _client


def _ping() -> bool:
    global _es_available
    if _es_available is not None:
        return _es_available
    try:
        c = get_client()
        _es_available = c is not None and c.ping(request_timeout=ES_TIMEOUT)
        if _es_available:
            logger.info("Elasticsearch connected → %s", ES_HOST)
        else:
            logger.info("Elasticsearch not reachable at %s — using mock data", ES_HOST)
    except Exception:
        _es_available = False
        logger.info("Elasticsearch not reachable at %s — using mock data", ES_HOST)
    return _es_available


def _reset():
    global _es_available
    _es_available = None


def _mock_status() -> dict:
    return {
        "connected": False, "status": "unavailable",
        "health": "unknown", "total_docs": 0, "index_count": 0,
        "unassigned_shards": 0, "number_of_nodes": 0,
        "indices": [], "time_series": _mock_time_series(),
        "top_error_sources": [],
    }


def _mock_time_series(points: int = 20) -> list[dict]:
    now = datetime.utcnow()
    return [
        {
            "time":     (now - timedelta(minutes=(points - i) * 3)).strftime("%H:%M"),
            "logs":     random.randint(200, 1200),
            "errors":   random.randint(5, 80),
            "warnings": random.randint(20, 150),
        }
        for i in range(points)
    ]


def get_cluster_health() -> dict:
    if not _ping():
        return {"connected": False, "health": "unknown", "status": "unavailable"}
    try:
        c = get_client()
        h = c.cluster.health(request_timeout=ES_TIMEOUT)
        return {
            "connected":         True,
            "health":            h["status"],
            "status":            "running",
            "number_of_nodes":   h["number_of_nodes"],
            "active_shards":     h["active_shards"],
            "unassigned_shards": h["unassigned_shards"],
        }
    except Exception as exc:
        logger.debug("ES cluster health error: %s", exc)
        _reset()
        return {"connected": False, "health": "unknown", "status": "error"}


def get_index_stats() -> list[dict]:
    if not _ping():
        return []
    try:
        c = get_client()
        resp = c.cat.indices(index=ES_INDEX, h="index,health,docs.count,store.size,pri,rep",
                             format="json", request_timeout=ES_TIMEOUT)
        result = []
        for idx in resp:
            try:
                result.append({
                    "name":      idx.get("index", ""),
                    "health":    idx.get("health", "unknown"),
                    "docs":      int(idx.get("docs.count") or 0),
                    "size":      idx.get("store.size", "0b"),
                    "primaries": int(idx.get("pri") or 1),
                    "replicas":  int(idx.get("rep") or 0),
                })
            except Exception:
                pass
        return sorted(result, key=lambda x: x["docs"], reverse=True)
    except Exception as exc:
        logger.debug("ES index stats error: %s", exc)
        return []


def get_log_time_series(minutes: int = 60) -> list[dict]:
    if not _ping():
        return _mock_time_series(20)
    try:
        c   = get_client()
        now = datetime.now(timezone.utc)
        ago = now - timedelta(minutes=minutes)
        resp = c.search(
            index=ES_INDEX,
            body={
                "size": 0,
                "query": {"range": {"@timestamp": {"gte": ago.isoformat(), "lte": now.isoformat()}}},
                "aggs": {
                    "over_time": {
                        "date_histogram": {"field": "@timestamp", "fixed_interval": "3m"},
                        "aggs": {
                            "errors":   {"filter": {"term":  {"log.level": "ERROR"}}},
                            "warnings": {"filter": {"term":  {"log.level": "WARN"}}},
                        },
                    }
                },
            },
            request_timeout=ES_TIMEOUT,
        )
        buckets = resp["aggregations"]["over_time"]["buckets"]
        return [
            {
                "time":     datetime.fromisoformat(b["key_as_string"].replace("Z", "+00:00")).strftime("%H:%M"),
                "logs":     b["doc_count"],
                "errors":   b["errors"]["doc_count"],
                "warnings": b["warnings"]["doc_count"],
            }
            for b in buckets
        ]
    except Exception as exc:
        logger.debug("ES time series error: %s", exc)
        return _mock_time_series(20)


def get_full_status() -> dict:
    if not _ping():
        return _mock_status()
    try:
        health  = get_cluster_health()
        indices = get_index_stats()
        series  = get_log_time_series(60)
        total_docs = sum(i["docs"] for i in indices)
        return {
            "connected":         True,
            "status":            "running",
            "health":            health.get("health", "unknown"),
            "total_docs":        total_docs,
            "index_count":       len(indices),
            "unassigned_shards": health.get("unassigned_shards", 0),
            "number_of_nodes":   health.get("number_of_nodes", 0),
            "indices":           indices,
            "time_series":       series,
            "top_error_sources": [],
        }
    except Exception as exc:
        logger.debug("ES full status error: %s", exc)
        return _mock_status()
