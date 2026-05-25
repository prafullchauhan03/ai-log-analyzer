"""
Detection rules engine.

Each rule is a dict with:
  id         – unique slug
  title      – human-readable name
  severity   – critical | high | medium | low
  category   – security | performance | infrastructure | anomaly
  source     – which service provides the metric
  metric_key – dot-path into the service payload
  threshold  – numeric threshold (rule fires when value EXCEEDS this)
  message_fn – callable(value, threshold) -> str  describing what happened
"""
from typing import Any

# ── helpers ───────────────────────────────────────────────────────────────────

def _get(d: dict, path: str) -> Any:
    """Safely resolve 'a.b.c' into nested dict d."""
    cur = d
    for key in path.split("."):
        if not isinstance(cur, dict):
            return None
        cur = cur.get(key)
    return cur


# ── rule definitions ──────────────────────────────────────────────────────────

RULES = [
    # ── Kafka ─────────────────────────────────────────────────────────────────
    {
        "id":         "kafka_high_lag",
        "title":      "Kafka Consumer Lag Critical",
        "severity":   "critical",
        "category":   "performance",
        "source":     "kafka",
        "metric_key": "total_lag",
        "threshold":  5000,
        "message_fn": lambda v, t: (
            f"Consumer group lag has reached {v:,} messages "
            f"(threshold: {int(t):,}). Consumers are falling behind producers."
        ),
    },
    {
        "id":         "kafka_medium_lag",
        "title":      "Kafka Consumer Lag Elevated",
        "severity":   "medium",
        "category":   "performance",
        "source":     "kafka",
        "metric_key": "total_lag",
        "threshold":  1000,
        "message_fn": lambda v, t: (
            f"Consumer group lag is {v:,} messages "
            f"(threshold: {int(t):,}). Monitor for continued growth."
        ),
    },
    {
        "id":         "kafka_no_brokers",
        "title":      "Kafka No Brokers Available",
        "severity":   "critical",
        "category":   "infrastructure",
        "source":     "kafka",
        "metric_key": "broker_count",
        "threshold":  None,          # special: fires when value == 0
        "message_fn": lambda v, t: (
            "No Kafka brokers are reachable. "
            "Message ingestion has stopped completely."
        ),
    },

    # ── Redis ─────────────────────────────────────────────────────────────────
    {
        "id":         "redis_memory_critical",
        "title":      "Redis Memory Critical",
        "severity":   "critical",
        "category":   "performance",
        "source":     "redis",
        "metric_key": "memory_pct",
        "threshold":  90,
        "message_fn": lambda v, t: (
            f"Redis memory usage is at {v:.1f}% "
            f"(threshold: {int(t)}%). Evictions may begin imminently."
        ),
    },
    {
        "id":         "redis_memory_high",
        "title":      "Redis Memory High",
        "severity":   "high",
        "category":   "performance",
        "source":     "redis",
        "metric_key": "memory_pct",
        "threshold":  75,
        "message_fn": lambda v, t: (
            f"Redis memory usage is at {v:.1f}% "
            f"(threshold: {int(t)}%). Consider increasing maxmemory or flushing stale keys."
        ),
    },
    {
        "id":         "redis_low_hit_rate",
        "title":      "Redis Cache Hit Rate Low",
        "severity":   "medium",
        "category":   "performance",
        "source":     "redis",
        "metric_key": "hit_rate",
        "threshold":  None,          # special: fires when hit_rate < 0.5
        "message_fn": lambda v, t: (
            f"Redis cache hit rate has dropped to {v*100:.1f}%. "
            "High miss rate increases load on primary data stores."
        ),
    },
    {
        "id":         "redis_evictions",
        "title":      "Redis Key Evictions Detected",
        "severity":   "high",
        "category":   "performance",
        "source":     "redis",
        "metric_key": "evicted_keys",
        "threshold":  0,
        "message_fn": lambda v, t: (
            f"Redis has evicted {int(v):,} keys due to memory pressure. "
            "Data may have been lost."
        ),
    },

    # ── Elasticsearch ─────────────────────────────────────────────────────────
    {
        "id":         "es_unassigned_shards",
        "title":      "Elasticsearch Unassigned Shards",
        "severity":   "high",
        "category":   "infrastructure",
        "source":     "elasticsearch",
        "metric_key": "unassigned_shards",
        "threshold":  0,
        "message_fn": lambda v, t: (
            f"Elasticsearch has {int(v)} unassigned shard(s). "
            "Cluster health is degraded — data may be unavailable."
        ),
    },
    {
        "id":         "es_red_health",
        "title":      "Elasticsearch Cluster Red",
        "severity":   "critical",
        "category":   "infrastructure",
        "source":     "elasticsearch",
        "metric_key": "health",
        "threshold":  None,          # special: fires when health == "red"
        "message_fn": lambda v, t: (
            "Elasticsearch cluster health is RED. "
            "Primary shards are missing — search and indexing are impaired."
        ),
    },
    {
        "id":         "es_yellow_health",
        "title":      "Elasticsearch Cluster Yellow",
        "severity":   "medium",
        "category":   "infrastructure",
        "source":     "elasticsearch",
        "metric_key": "health",
        "threshold":  None,          # special: fires when health == "yellow"
        "message_fn": lambda v, t: (
            "Elasticsearch cluster health is YELLOW. "
            "Replica shards are unassigned — redundancy is reduced."
        ),
    },

    # ── AI / anomaly ──────────────────────────────────────────────────────────
    {
        "id":         "ai_threat_critical",
        "title":      "AI Threat Score Critical",
        "severity":   "critical",
        "category":   "anomaly",
        "source":     "ai",
        "metric_key": "ai_threat_score",
        "threshold":  0.80,
        "message_fn": lambda v, t: (
            f"AI anomaly model scored the current log pattern at {v:.2f} "
            f"(threshold: {t}). Possible security incident or system attack in progress."
        ),
    },
    {
        "id":         "ai_threat_high",
        "title":      "AI Threat Score Elevated",
        "severity":   "high",
        "category":   "anomaly",
        "source":     "ai",
        "metric_key": "ai_threat_score",
        "threshold":  0.60,
        "message_fn": lambda v, t: (
            f"AI anomaly model scored the current log pattern at {v:.2f} "
            f"(threshold: {t}). Unusual activity detected — review recent log events."
        ),
    },
]


# ── public API ────────────────────────────────────────────────────────────────

def evaluate_rules(metrics: dict) -> list[dict]:
    """
    Run all rules against a metrics snapshot.
    Returns a list of fired-rule dicts (no DB writes here).

    metrics shape:
      {
        "kafka":         { "total_lag": ..., "broker_count": ... },
        "redis":         { "memory_pct": ..., "hit_rate": ..., ... },
        "elasticsearch": { "unassigned_shards": ..., "health": ... },
        "ai_threat_score": 0.72,
      }
    """
    fired = []

    for rule in RULES:
        source    = rule["source"]
        metric_key = rule["metric_key"]

        # Resolve value — top-level or nested under source name
        if source in metrics:
            value = _get(metrics[source], metric_key)
        else:
            value = _get(metrics, metric_key)

        if value is None:
            continue

        threshold = rule["threshold"]
        triggered = False

        # ── special zero-threshold rules ──────────────────────────────────────
        if rule["id"] == "kafka_no_brokers":
            triggered = (isinstance(value, (int, float)) and value == 0)

        elif rule["id"] == "redis_low_hit_rate":
            triggered = (isinstance(value, float) and value < 0.5)

        elif rule["id"] == "es_red_health":
            triggered = (str(value).lower() == "red")

        elif rule["id"] == "es_yellow_health":
            triggered = (str(value).lower() == "yellow")

        # ── standard numeric threshold ────────────────────────────────────────
        elif threshold is not None:
            try:
                triggered = float(value) > float(threshold)
            except (TypeError, ValueError):
                pass

        if triggered:
            fired.append({
                "rule_id":      rule["id"],
                "title":        rule["title"],
                "severity":     rule["severity"],
                "category":     rule["category"],
                "source":       source,
                "metric_key":   metric_key,
                "metric_value": float(value) if isinstance(value, (int, float)) else 0.0,
                "threshold":    float(threshold) if threshold is not None else 0.0,
                "message":      rule["message_fn"](value, threshold),
            })

    return fired
