import os
from dotenv import load_dotenv

load_dotenv()

# ── Auth ──────────────────────────────────────────────────────────────────────
SECRET_KEY = os.getenv("SECRET_KEY", "supersecret-change-in-production")

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./ai_log_analyzer.db")

# ── Elasticsearch ─────────────────────────────────────────────────────────────
ES_HOST       = os.getenv("ES_HOST", "http://localhost:9200")
ES_USERNAME   = os.getenv("ES_USERNAME", "")
ES_PASSWORD   = os.getenv("ES_PASSWORD", "")
ES_API_KEY    = os.getenv("ES_API_KEY", "")
ES_INDEX      = os.getenv("ES_INDEX", "logs-*")          # index pattern to query
ES_TIMEOUT    = int(os.getenv("ES_TIMEOUT", "2"))

# ── Kafka ─────────────────────────────────────────────────────────────────────
KAFKA_BROKERS        = os.getenv("KAFKA_BROKERS", "localhost:9092")   # comma-separated
KAFKA_CONSUMER_GROUP = os.getenv("KAFKA_CONSUMER_GROUP", "log-consumers")
KAFKA_TOPICS         = os.getenv("KAFKA_TOPICS", "logs-raw,logs-processed,logs-alerts")
KAFKA_TIMEOUT        = int(os.getenv("KAFKA_TIMEOUT", "2"))

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_HOST     = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT     = int(os.getenv("REDIS_PORT", "6379"))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", "")
REDIS_DB       = int(os.getenv("REDIS_DB", "0"))
REDIS_TIMEOUT  = int(os.getenv("REDIS_TIMEOUT", "2"))

# ── Groq AI ───────────────────────────────────────────────────────────────────
GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")
