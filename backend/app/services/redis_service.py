"""
Redis service — memory stats, keyspace, hit/miss rate, slow log.
Caches availability so offline Redis doesn't add latency after first check.
"""
import logging
from app.config import REDIS_HOST, REDIS_PORT, REDIS_PASSWORD, REDIS_DB, REDIS_TIMEOUT

logger          = logging.getLogger(__name__)
_client         = None
_redis_available = None   # None=untested, True/False cached


def get_client():
    global _client
    if _client is not None:
        return _client
    try:
        import redis
        kwargs = {
            "host": REDIS_HOST, "port": REDIS_PORT, "db": REDIS_DB,
            "socket_connect_timeout": REDIS_TIMEOUT,
            "socket_timeout":         REDIS_TIMEOUT,
            "decode_responses":       True,
        }
        if REDIS_PASSWORD:
            kwargs["password"] = REDIS_PASSWORD
        _client = redis.Redis(**kwargs)
    except Exception as exc:
        logger.debug("Redis client init error: %s", exc)
    return _client


def _ping() -> bool:
    global _redis_available
    if _redis_available is not None:
        return _redis_available
    try:
        c = get_client()
        _redis_available = c is not None and c.ping()
        if _redis_available:
            logger.info("Redis connected → %s:%s", REDIS_HOST, REDIS_PORT)
        else:
            logger.info("Redis not reachable at %s:%s — using mock data", REDIS_HOST, REDIS_PORT)
    except Exception:
        _redis_available = False
        logger.info("Redis not reachable at %s:%s — using mock data", REDIS_HOST, REDIS_PORT)
    return _redis_available


def _reset():
    global _redis_available
    _redis_available = None


def _mock_status() -> dict:
    return {
        "connected": False, "status": "unavailable",
        "redis_version": "n/a", "uptime_hours": 0,
        "used_memory_mb": 0, "peak_memory_mb": 0, "memory_pct": 0,
        "hit_rate": 0, "total_keys": 0, "ops_per_sec": 0,
        "connected_clients": 0, "blocked_clients": 0,
        "evicted_keys": 0, "expired_keys": 0,
        "fragmentation_ratio": 1.0, "keyspaces": [],
        "replication": {}, "slow_log": [],
    }


def get_full_status() -> dict:
    if not _ping():
        return _mock_status()
    try:
        c    = get_client()
        info = c.info()

        used_mb  = round(info.get("used_memory", 0) / 1024 / 1024, 2)
        max_mem  = info.get("maxmemory", 0)
        mem_pct  = round((info["used_memory"] / max_mem) * 100, 1) if max_mem > 0 else 0

        hits     = info.get("keyspace_hits",   0)
        misses   = info.get("keyspace_misses", 0)
        hit_rate = round(hits / (hits + misses), 4) if (hits + misses) > 0 else 1.0

        keyspaces = []
        for key, val in info.items():
            if key.startswith("db"):
                try:
                    parts = {p.split("=")[0]: int(p.split("=")[1]) for p in val.split(",")}
                    keyspaces.append({
                        "db":         int(key[2:]),
                        "keys":       parts.get("keys", 0),
                        "expires":    parts.get("expires", 0),
                        "avg_ttl_ms": parts.get("avg_ttl", 0),
                    })
                except Exception:
                    pass

        try:
            slow_log = [
                {"id": e[0], "duration_us": e[2], "command": " ".join(str(x) for x in e[3])}
                for e in c.slowlog_get(5)
            ]
        except Exception:
            slow_log = []

        repl = c.info("replication")

        return {
            "connected":           True,
            "status":              "running",
            "redis_version":       info.get("redis_version", "?"),
            "uptime_hours":        round(info.get("uptime_in_seconds", 0) / 3600, 1),
            "used_memory_mb":      used_mb,
            "peak_memory_mb":      round(info.get("used_memory_peak", 0) / 1024 / 1024, 2),
            "memory_pct":          mem_pct,
            "hit_rate":            hit_rate,
            "total_keys":          sum(k["keys"] for k in keyspaces),
            "ops_per_sec":         info.get("instantaneous_ops_per_sec", 0),
            "connected_clients":   info.get("connected_clients", 0),
            "blocked_clients":     info.get("blocked_clients", 0),
            "evicted_keys":        info.get("evicted_keys", 0),
            "expired_keys":        info.get("expired_keys", 0),
            "fragmentation_ratio": info.get("mem_fragmentation_ratio", 1.0),
            "keyspaces":           keyspaces,
            "replication": {
                "role":              repl.get("role", "?"),
                "connected_slaves":  repl.get("connected_slaves", 0),
            },
            "slow_log": slow_log,
        }
    except Exception as exc:
        logger.debug("Redis full status error: %s", exc)
        _reset()
        return _mock_status()
