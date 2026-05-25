"""
/infra/elasticsearch  — cluster health, indices, log volume
/infra/kafka          — brokers, topics, consumer lag
/infra/redis          — memory, keyspace, hit rate, slow log
/infra/status         — all three in one call (for dashboard summary cards)
"""
from fastapi import APIRouter, Depends
from app.auth.dependencies import get_current_user
import app.services.elasticsearch_service as es_svc
import app.services.kafka_service as kafka_svc
import app.services.redis_service as redis_svc

router = APIRouter(prefix="/infra", tags=["Infrastructure"])


# ── Elasticsearch ─────────────────────────────────────────────────────────────

@router.get("/elasticsearch")
def elasticsearch_status(user=Depends(get_current_user)):
    return es_svc.get_full_status()


@router.get("/elasticsearch/health")
def elasticsearch_health(user=Depends(get_current_user)):
    return es_svc.get_cluster_health()


@router.get("/elasticsearch/indices")
def elasticsearch_indices(user=Depends(get_current_user)):
    return {"indices": es_svc.get_indices_stats()}


@router.get("/elasticsearch/timeseries")
def elasticsearch_timeseries(minutes: int = 60, user=Depends(get_current_user)):
    return {"time_series": es_svc.get_log_volume_time_series(minutes=minutes)}


@router.get("/elasticsearch/errors")
def elasticsearch_top_errors(size: int = 5, user=Depends(get_current_user)):
    return {"top_errors": es_svc.get_top_error_sources(size=size)}


# ── Kafka ─────────────────────────────────────────────────────────────────────

@router.get("/kafka")
def kafka_status(user=Depends(get_current_user)):
    return kafka_svc.get_full_status()


@router.get("/kafka/brokers")
def kafka_brokers(user=Depends(get_current_user)):
    return kafka_svc.get_broker_metadata()


@router.get("/kafka/topics")
def kafka_topics(user=Depends(get_current_user)):
    return {"topics": kafka_svc.get_topic_offsets()}


@router.get("/kafka/lag")
def kafka_lag(user=Depends(get_current_user)):
    return {"consumer_groups": kafka_svc.get_consumer_group_lag()}


# ── Redis ─────────────────────────────────────────────────────────────────────

@router.get("/redis")
def redis_status(user=Depends(get_current_user)):
    return redis_svc.get_full_status()


@router.get("/redis/slowlog")
def redis_slowlog(user=Depends(get_current_user)):
    return {"slow_log": redis_svc.get_slow_log()}


# ── Combined summary (dashboard cards) ───────────────────────────────────────

@router.get("/status")
def infra_summary(user=Depends(get_current_user)):
    """
    Lightweight summary of all three services for the dashboard overview cards.
    Each service fetches concurrently via threads.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

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
                results[name] = {"connected": False, "status": "error", "error": str(exc)}

    return results
