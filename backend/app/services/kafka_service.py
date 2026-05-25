"""
Kafka service — real consumer group lag, topic offsets, broker metadata.
Falls back cleanly if Kafka is unreachable. Logs at DEBUG (not WARNING)
when Kafka is simply not configured, to avoid log spam.
"""
import logging
from app.config import (
    KAFKA_BROKERS, KAFKA_CONSUMER_GROUP,
    KAFKA_TOPICS, KAFKA_TIMEOUT
)

logger   = logging.getLogger(__name__)
_brokers = [b.strip() for b in KAFKA_BROKERS.split(",")]
_topics  = [t.strip() for t in KAFKA_TOPICS.split(",")]

# Simple in-process flag so we don't retry every 60 s after a definitive failure
_kafka_available: bool | None = None   # None = untested


def _mock_status() -> dict:
    return {
        "connected":       False,
        "status":          "unavailable",
        "brokers":         [],
        "broker_count":    0,
        "topics":          [],
        "consumer_groups": [],
        "total_lag":       0,
        "error":           "Kafka not reachable — set KAFKA_BROKERS in .env",
    }


def _try_connect() -> bool:
    """Returns True if at least one broker is reachable. Caches the result."""
    global _kafka_available
    if _kafka_available is not None:
        return _kafka_available
    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(
            bootstrap_servers=_brokers,
            consumer_timeout_ms=KAFKA_TIMEOUT * 1000,
            request_timeout_ms=KAFKA_TIMEOUT * 1000,
        )
        consumer.close()
        _kafka_available = True
        logger.info("Kafka connection established → %s", _brokers)
    except Exception as exc:
        _kafka_available = False
        # Only log once at INFO, not WARNING, since offline Kafka is expected in dev
        logger.info("Kafka not available (%s) — metrics will show as unavailable", exc)
    return _kafka_available


def _reset_availability():
    """Call this to force a re-check on the next request (e.g. after a reconnect attempt)."""
    global _kafka_available
    _kafka_available = None


# ── Public API ────────────────────────────────────────────────────────────────

def get_broker_metadata() -> dict:
    if not _try_connect():
        return {"connected": False, "brokers": [], "error": "Kafka not reachable"}
    try:
        from kafka import KafkaConsumer
        consumer = KafkaConsumer(
            bootstrap_servers=_brokers,
            consumer_timeout_ms=KAFKA_TIMEOUT * 1000,
            request_timeout_ms=KAFKA_TIMEOUT * 1000,
        )
        metadata = consumer._client.cluster
        brokers  = [
            {"id": b.nodeId, "host": b.host, "port": b.port}
            for b in metadata.brokers()
        ]
        consumer.close()
        return {"connected": True, "brokers": brokers}
    except Exception as exc:
        logger.debug("Kafka broker metadata error: %s", exc)
        _reset_availability()
        return {"connected": False, "brokers": [], "error": str(exc)}


def get_topic_offsets() -> list[dict]:
    if not _try_connect():
        return []
    try:
        from kafka import KafkaConsumer, TopicPartition
        consumer = KafkaConsumer(
            bootstrap_servers=_brokers,
            consumer_timeout_ms=KAFKA_TIMEOUT * 1000,
            request_timeout_ms=KAFKA_TIMEOUT * 1000,
        )
        result = []
        for topic in _topics:
            try:
                partitions = consumer.partitions_for_topic(topic)
                if not partitions:
                    result.append({"topic": topic, "partitions": 0, "total_messages": 0, "status": "empty"})
                    continue
                tps           = [TopicPartition(topic, p) for p in partitions]
                end_offsets   = consumer.end_offsets(tps)
                begin_offsets = consumer.beginning_offsets(tps)
                total         = sum(end_offsets[tp] - begin_offsets[tp] for tp in tps)
                result.append({"topic": topic, "partitions": len(partitions), "total_messages": total, "status": "active"})
            except Exception as te:
                result.append({"topic": topic, "partitions": 0, "total_messages": 0, "status": "error", "error": str(te)})
        consumer.close()
        return result
    except Exception as exc:
        logger.debug("Kafka topic offsets error: %s", exc)
        return []


def get_consumer_group_lag() -> list[dict]:
    if not _try_connect():
        return []
    try:
        from kafka import KafkaConsumer, KafkaAdminClient, TopicPartition
        admin = KafkaAdminClient(
            bootstrap_servers=_brokers,
            request_timeout_ms=KAFKA_TIMEOUT * 1000,
            connections_max_idle_ms=KAFKA_TIMEOUT * 1000 + 1000,
            client_id="ai-log-analyzer-admin",
        )
        offsets_response = admin.list_consumer_group_offsets(KAFKA_CONSUMER_GROUP)
        admin.close()

        consumer = KafkaConsumer(
            bootstrap_servers=_brokers,
            consumer_timeout_ms=KAFKA_TIMEOUT * 1000,
            request_timeout_ms=KAFKA_TIMEOUT * 1000,
        )
        result = []
        for topic in _topics:
            try:
                partitions = consumer.partitions_for_topic(topic)
                if not partitions:
                    continue
                tps         = [TopicPartition(topic, p) for p in partitions]
                end_offsets = consumer.end_offsets(tps)
                partition_lags, total_lag = [], 0
                for tp in tps:
                    committed        = offsets_response.get(tp)
                    committed_offset = committed.offset if committed else 0
                    end              = end_offsets.get(tp, 0)
                    lag              = max(0, end - committed_offset)
                    total_lag       += lag
                    partition_lags.append({"partition": tp.partition, "committed": committed_offset, "end": end, "lag": lag})
                result.append({
                    "topic": topic, "group": KAFKA_CONSUMER_GROUP,
                    "total_lag": total_lag, "partitions": partition_lags,
                    "status": "lagging" if total_lag > 1000 else "healthy",
                })
            except Exception as te:
                logger.debug("Lag calc error for topic %s: %s", topic, te)
                result.append({"topic": topic, "group": KAFKA_CONSUMER_GROUP, "total_lag": 0, "partitions": [], "status": "error"})
        consumer.close()
        return result
    except Exception as exc:
        logger.debug("Kafka consumer group lag error: %s", exc)
        return []


def get_full_status() -> dict:
    broker_info = get_broker_metadata()
    if not broker_info["connected"]:
        return _mock_status()
    try:
        topics    = get_topic_offsets()
        lag       = get_consumer_group_lag()
        total_lag = sum(g["total_lag"] for g in lag)
        return {
            "connected":       True,
            "status":          "running",
            "brokers":         broker_info["brokers"],
            "broker_count":    len(broker_info["brokers"]),
            "topics":          topics,
            "consumer_groups": lag,
            "total_lag":       total_lag,
            "lag_status":      "lagging" if total_lag > 1000 else "healthy",
        }
    except Exception as exc:
        logger.debug("Kafka full status error: %s", exc)
        mock = _mock_status()
        mock["error"] = str(exc)
        return mock
