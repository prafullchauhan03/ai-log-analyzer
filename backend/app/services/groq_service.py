"""
Groq AI service — uses llama-3.3-70b to analyse live system metrics,
generate insights, answer chat questions, and summarise alerts.

All public functions return structured dicts safe to serialise as JSON.
If GROQ_API_KEY is missing the service returns graceful mock responses.
"""
import json
import logging
import re
from datetime import datetime, timezone
from typing import Any

from app.config import GROQ_API_KEY, GROQ_MODEL

logger = logging.getLogger(__name__)

# ── client factory ────────────────────────────────────────────────────────────

_client = None


# None  = not yet tried
# False = tried and failed (don't retry until restart)
_client_failed = False

def _get_client():
    global _client, _client_failed
    if _client is not None:
        return _client
    if _client_failed:
        return None
    if not GROQ_API_KEY:
        logger.info("GROQ_API_KEY not set — AI features will show mock data")
        _client_failed = True
        return None
    try:
        from groq import Groq
        _client = Groq(api_key=GROQ_API_KEY)
        logger.info("Groq client initialised — model: %s", GROQ_MODEL)
    except TypeError as exc:
        # httpx version conflict — groq SDK uses old proxies= kwarg
        logger.error(
            "Groq client failed (httpx version conflict): %s. "
            "Fix: run  pip install groq==0.13.0 httpx==0.27.2", exc
        )
        _client_failed = True
    except Exception as exc:
        logger.error("Could not create Groq client: %s", exc)
        _client_failed = True
    return _client


def _is_available() -> bool:
    return _get_client() is not None


# ── low-level call ────────────────────────────────────────────────────────────

def _chat(messages: list[dict], temperature: float = 0.3, max_tokens: int = 1024) -> str:
    """Call Groq and return the assistant text, or raise on failure."""
    client = _get_client()
    if client is None:
        raise RuntimeError("Groq client not available — set GROQ_API_KEY in .env")

    resp = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return resp.choices[0].message.content.strip()


def _json_chat(messages: list[dict], temperature: float = 0.2, max_tokens: int = 1024) -> Any:
    """Call Groq expecting a JSON response. Strips markdown fences if present."""
    raw = _chat(messages, temperature=temperature, max_tokens=max_tokens)
    # strip ```json ... ``` fences
    clean = re.sub(r"^```(?:json)?\s*", "", raw.strip())
    clean = re.sub(r"\s*```$", "", clean)
    return json.loads(clean)


# ── system prompts ────────────────────────────────────────────────────────────

_SYSTEM_ANALYST = """You are an expert Site Reliability Engineer and Security Analyst embedded in an enterprise log monitoring platform called AI Log Analyzer Enterprise.

You analyse real-time metrics from Elasticsearch, Apache Kafka, Redis, and application servers. Your job is to:
- Identify patterns, anomalies, and risks in the data presented
- Give clear, actionable recommendations with priority levels
- Be concise, specific, and technical — avoid vague advice
- Always ground your analysis in the actual numbers provided

Respond only with valid JSON as specified in each prompt. No prose outside the JSON."""

_SYSTEM_CHAT = """You are an expert SRE and Security Analyst assistant embedded in AI Log Analyzer Enterprise — an enterprise log monitoring platform.

You have access to live system metrics (Elasticsearch, Kafka, Redis) and recent alert history provided in each message.

Rules:
- Answer questions about the system using the metrics provided
- Be specific — reference actual numbers from the context
- If asked something outside your data, say so honestly
- Keep answers concise (3-6 sentences unless a detailed breakdown is asked for)
- Use technical language appropriate for an SRE audience"""


# ── metric snapshot builder ───────────────────────────────────────────────────

def _build_snapshot(metrics: dict) -> str:
    """Render metrics dict as a compact human-readable block for prompts."""
    es    = metrics.get("elasticsearch", {})
    kafka = metrics.get("kafka", {})
    redis = metrics.get("redis", {})
    score = metrics.get("ai_threat_score", 0)

    lines = [
        f"=== SYSTEM SNAPSHOT — {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')} ===",
        "",
        "ELASTICSEARCH:",
        f"  connected={es.get('connected', False)}  health={es.get('health','unknown')}",
        f"  total_docs={es.get('total_docs',0):,}  indices={es.get('index_count',0)}",
        f"  unassigned_shards={es.get('unassigned_shards',0)}",
        "",
        "KAFKA:",
        f"  connected={kafka.get('connected', False)}  status={kafka.get('status','unknown')}",
        f"  brokers={kafka.get('broker_count',0)}  topics={len(kafka.get('topics',[]))}",
        f"  total_consumer_lag={kafka.get('total_lag',0):,}",
    ]

    for t in kafka.get("topics", []):
        lines.append(f"  topic={t['topic']}  msgs={t.get('total_messages',0):,}  status={t.get('status','?')}")

    for g in kafka.get("consumer_groups", []):
        lines.append(f"  consumer_group={g['topic']}  lag={g.get('total_lag',0):,}  status={g.get('status','?')}")

    lines += [
        "",
        "REDIS:",
        f"  connected={redis.get('connected', False)}  version={redis.get('redis_version','?')}",
        f"  used_memory={redis.get('used_memory_mb',0)} MB  memory_pct={redis.get('memory_pct',0):.1f}%",
        f"  hit_rate={redis.get('hit_rate',0)*100:.1f}%  evicted_keys={redis.get('evicted_keys',0)}",
        f"  ops_per_sec={redis.get('ops_per_sec',0)}  connected_clients={redis.get('connected_clients',0)}",
        "",
        f"AI THREAT SCORE: {score:.4f}  (0=safe, 1=critical)",
    ]

    return "\n".join(lines)


# ── public insight generators ─────────────────────────────────────────────────

def generate_system_analysis(metrics: dict) -> dict:
    """
    Full system health analysis — executive summary + per-service findings.
    Returns:
      { summary, risk_level, findings: [{service, severity, title, detail, action}],
        recommendations: [{priority, action, rationale}], generated_at }
    """
    if not _is_available():
        return _mock_analysis()

    snapshot = _build_snapshot(metrics)
    prompt = f"""{snapshot}

Analyse this system snapshot and return JSON with this exact structure:
{{
  "summary": "<2-3 sentence executive summary of system health>",
  "risk_level": "<one of: healthy | low | medium | high | critical>",
  "findings": [
    {{
      "service": "<elasticsearch|kafka|redis|system>",
      "severity": "<info|warning|error|critical>",
      "title": "<short finding title>",
      "detail": "<specific detail referencing actual metric values>",
      "action": "<immediate action to take>"
    }}
  ],
  "recommendations": [
    {{
      "priority": "<high|medium|low>",
      "action": "<concrete action>",
      "rationale": "<why this matters>"
    }}
  ]
}}

Include only real findings based on the data. Return 2-5 findings and 2-4 recommendations."""

    try:
        result = _json_chat([
            {"role": "system",  "content": _SYSTEM_ANALYST},
            {"role": "user",    "content": prompt},
        ])
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["model"]        = GROQ_MODEL
        return result
    except Exception as exc:
        logger.error("Groq system analysis error: %s", exc)
        return {"error": str(exc), "generated_at": datetime.now(timezone.utc).isoformat()}


def generate_anomaly_report(metrics: dict) -> dict:
    """
    Focused anomaly detection — looks for unusual patterns and deviations.
    Returns:
      { anomalies: [{metric, observed, expected, deviation_pct, severity, explanation}],
        anomaly_count, overall_anomaly_score, generated_at }
    """
    if not _is_available():
        return _mock_anomaly_report()

    snapshot = _build_snapshot(metrics)
    prompt = f"""{snapshot}

Identify anomalies and unusual patterns. Return JSON:
{{
  "anomalies": [
    {{
      "metric": "<metric name>",
      "observed": "<observed value>",
      "expected": "<expected normal range>",
      "deviation_pct": <numeric % deviation, can be 0 if directional>,
      "severity": "<low|medium|high|critical>",
      "explanation": "<why this is anomalous and what it could indicate>"
    }}
  ],
  "anomaly_count": <integer>,
  "overall_anomaly_score": <float 0.0-1.0>,
  "narrative": "<1-2 sentence overall anomaly narrative>"
}}

Base anomaly detection on typical SRE thresholds (e.g. >70% memory is elevated, >1000 kafka lag is concerning, cache hit rate <80% is unusual for production)."""

    try:
        result = _json_chat([
            {"role": "system", "content": _SYSTEM_ANALYST},
            {"role": "user",   "content": prompt},
        ])
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["model"]        = GROQ_MODEL
        return result
    except Exception as exc:
        logger.error("Groq anomaly report error: %s", exc)
        return {"error": str(exc), "anomalies": [], "generated_at": datetime.now(timezone.utc).isoformat()}


def generate_alert_summary(alerts: list[dict]) -> dict:
    """
    AI summary of the current alert backlog.
    Returns: { summary, top_concern, pattern, suggested_triage, generated_at }
    """
    if not _is_available():
        return _mock_alert_summary()

    if not alerts:
        return {
            "summary": "No open alerts — system is operating normally.",
            "top_concern": None,
            "pattern": "No alert patterns detected.",
            "suggested_triage": [],
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    alert_text = "\n".join(
        f"[{a['severity'].upper()}] {a['title']} — {a['message']} (status: {a['status']})"
        for a in alerts[:20]
    )

    prompt = f"""Current open alerts:\n{alert_text}\n
Analyse this alert backlog and return JSON:
{{
  "summary": "<2-3 sentence summary of the alert situation>",
  "top_concern": "<the single most urgent issue and why>",
  "pattern": "<any pattern you notice across these alerts>",
  "suggested_triage": [
    {{
      "order": 1,
      "alert_title": "<title>",
      "reason": "<why tackle this first>"
    }}
  ]
}}

Suggest triage order for the top 3 most critical alerts."""

    try:
        result = _json_chat([
            {"role": "system", "content": _SYSTEM_ANALYST},
            {"role": "user",   "content": prompt},
        ])
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["model"]        = GROQ_MODEL
        return result
    except Exception as exc:
        logger.error("Groq alert summary error: %s", exc)
        return {"error": str(exc), "generated_at": datetime.now(timezone.utc).isoformat()}


def generate_forecast(metrics: dict, time_series: list[dict]) -> dict:
    """
    Short-term trend forecast based on current metrics + time series.
    Returns: { forecasts: [{metric, trend, forecast_1h, risk, recommendation}], generated_at }
    """
    if not _is_available():
        return _mock_forecast()

    snapshot = _build_snapshot(metrics)
    # Summarise time series
    if time_series:
        recent = time_series[-5:]
        ts_text = "Recent log volume (last 5 intervals):\n" + "\n".join(
            f"  {p['time']}: logs={p.get('logs',0)} errors={p.get('errors',0)} warnings={p.get('warnings',0)}"
            for p in recent
        )
    else:
        ts_text = "No time series data available."

    prompt = f"""{snapshot}

{ts_text}

Based on current metrics and trends, forecast the next 1 hour. Return JSON:
{{
  "forecasts": [
    {{
      "metric": "<metric name>",
      "current_value": "<current value>",
      "trend": "<increasing|decreasing|stable|volatile>",
      "forecast_1h": "<predicted value or range in 1 hour>",
      "risk": "<none|low|medium|high|critical>",
      "recommendation": "<action to take now to prevent issues>"
    }}
  ],
  "overall_outlook": "<healthy|caution|warning|critical>",
  "narrative": "<2-3 sentence forecast narrative>"
}}

Focus on the metrics most likely to cause incidents if current trends continue."""

    try:
        result = _json_chat([
            {"role": "system", "content": _SYSTEM_ANALYST},
            {"role": "user",   "content": prompt},
        ])
        result["generated_at"] = datetime.now(timezone.utc).isoformat()
        result["model"]        = GROQ_MODEL
        return result
    except Exception as exc:
        logger.error("Groq forecast error: %s", exc)
        return {"error": str(exc), "generated_at": datetime.now(timezone.utc).isoformat()}


def chat_with_context(question: str, metrics: dict, alerts: list[dict], history: list[dict]) -> dict:
    """
    Free-form Q&A about the system with full metric context.
    history: list of {role, content} prior turns (max last 6)
    Returns: { answer, generated_at }
    """
    if not _is_available():
        return {
            "answer": "AI assistant is not available — please set GROQ_API_KEY in your .env file.",
            "generated_at": datetime.now(timezone.utc).isoformat(),
        }

    snapshot  = _build_snapshot(metrics)
    alert_ctx = ""
    if alerts:
        alert_ctx = "\nRECENT ALERTS:\n" + "\n".join(
            f"  [{a['severity'].upper()}] {a['title']} ({a['status']})"
            for a in alerts[:10]
        )

    context_msg = {
        "role": "user",
        "content": f"[SYSTEM CONTEXT]\n{snapshot}{alert_ctx}\n[END CONTEXT]\n\nUser question: {question}",
    }

    messages = [{"role": "system", "content": _SYSTEM_CHAT}]
    # Inject up to last 6 history turns
    for turn in (history or [])[-6:]:
        if turn.get("role") in ("user", "assistant") and turn.get("content"):
            messages.append({"role": turn["role"], "content": turn["content"]})
    messages.append(context_msg)

    try:
        answer = _chat(messages, temperature=0.4, max_tokens=512)
        return {
            "answer": answer,
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "model": GROQ_MODEL,
        }
    except Exception as exc:
        logger.error("Groq chat error: %s", exc)
        return {"answer": f"Error: {exc}", "generated_at": datetime.now(timezone.utc).isoformat()}


# ── mock fallbacks (GROQ_API_KEY not set) ────────────────────────────────────

def _mock_analysis() -> dict:
    return {
        "summary": "Groq API key not configured. Set GROQ_API_KEY in .env to enable AI analysis.",
        "risk_level": "unknown",
        "findings": [
            {"service": "system", "severity": "info",
             "title": "AI Analysis Unavailable",
             "detail": "GROQ_API_KEY environment variable is not set.",
             "action": "Add GROQ_API_KEY to your .env file. Get a free key at console.groq.com"}
        ],
        "recommendations": [
            {"priority": "high", "action": "Configure Groq API key",
             "rationale": "AI-powered analysis requires a Groq API key"}
        ],
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": "none",
    }


def _mock_anomaly_report() -> dict:
    return {
        "anomalies": [],
        "anomaly_count": 0,
        "overall_anomaly_score": 0.0,
        "narrative": "AI anomaly detection unavailable — set GROQ_API_KEY in .env.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _mock_alert_summary() -> dict:
    return {
        "summary": "AI alert summarisation unavailable — set GROQ_API_KEY in .env.",
        "top_concern": None,
        "pattern": "N/A",
        "suggested_triage": [],
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }


def _mock_forecast() -> dict:
    return {
        "forecasts": [],
        "overall_outlook": "unknown",
        "narrative": "AI forecasting unavailable — set GROQ_API_KEY in .env.",
        "generated_at": datetime.now(timezone.utc).isoformat(),
    }
