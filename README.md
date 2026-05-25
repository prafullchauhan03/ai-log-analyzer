# AI Log Analyzer Enterprise

> **Live demo:** https://ai-log-analyzer.vercel.app  
> **Demo login:** `admin@demo.com` / `hackathon2026`

An enterprise log monitoring platform with real-time streaming, AI-powered analysis via Groq (llama-3.3-70b-versatile), and automatic alert detection across Elasticsearch, Kafka, and Redis.

---

## What it does

- **Real-time log streaming** — WebSocket feed with level filtering, search, pause/resume, and CSV export
- **AI System Analysis** — Groq LLM analyses live metrics and returns structured findings, risks, and prioritised recommendations
- **Anomaly Detection** — AI identifies unusual patterns across all infrastructure metrics
- **1-Hour Trend Forecast** — predictive outlook for Kafka lag, Redis memory, error rates, and threat score
- **AI Alert Triage** — summarises the open alert backlog and suggests resolution order
- **AI Chat Assistant** — ask free-form questions about your system; Claude answers with live metric context
- **Automatic Alert Engine** — rule-based detection for 12 alert conditions across ES/Kafka/Redis/AI threat score with 30-minute dedup
- **Full Auth** — JWT login, role-based access (viewer / analyst / admin), password management

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | FastAPI + Uvicorn |
| AI | Groq API (`llama-3.3-70b-versatile`) |
| Auth | JWT (python-jose) + bcrypt |
| Database | SQLite (dev) / PostgreSQL (prod) |
| ORM | SQLAlchemy |
| Frontend | React 18 + Vite |
| Charts | Recharts |
| Real-time | WebSockets |
| Styling | CSS Variables + DM Sans / Space Mono |
| Deployment | Render (backend) + Vercel (frontend) |

---

## Quickstart (Local)

### 1. Backend

```bash
cd backend
python -m venv venv && source venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
# Edit .env — add your GROQ_API_KEY (free at console.groq.com)
uvicorn app.main:app --reload
# API: http://localhost:8000
# Docs: http://localhost:8000/docs
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
# UI: http://localhost:5173
```

### 3. Seed demo data

```bash
cd backend
python scripts/seed_demo.py
```

---

## Deploy to production

### Backend → Render (free)

1. Push repo to GitHub
2. New Web Service on render.com → connect repo
3. Set root directory: `backend`
4. Build command: `pip install -r requirements.txt`
5. Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
6. Add env vars in Render dashboard:
   - `SECRET_KEY` — any long random string
   - `GROQ_API_KEY` — your Groq key
   - `DATABASE_URL` — leave as SQLite for hackathon, or add Render PostgreSQL
7. Note your Render URL: `https://your-app.onrender.com`

### Frontend → Vercel (free)

1. Import frontend folder on vercel.com
2. Add env var: `VITE_API_URL=https://your-app.onrender.com`
3. Deploy → get your `https://your-app.vercel.app` URL
4. Add that URL to `allow_origins` in `backend/app/main.py` and redeploy backend

---

## API Reference

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | /auth/register | ❌ | Create account |
| POST | /auth/login | ❌ | Get JWT token |
| GET | /auth/me | ✅ | Current user info |
| GET | /dashboard/stats | ✅ | KPIs, charts, infra status |
| GET | /alerts | ✅ | Alert list (filterable) |
| POST | /alerts/detect | ✅ | Run detection now |
| PATCH | /alerts/{id}/acknowledge | ✅ | Acknowledge alert |
| PATCH | /alerts/{id}/resolve | ✅ | Resolve alert |
| GET | /infra/elasticsearch | ✅ | ES cluster status |
| GET | /infra/kafka | ✅ | Kafka broker/lag status |
| GET | /infra/redis | ✅ | Redis memory/keyspace |
| POST | /ai/analysis | ✅ | Full AI system analysis |
| POST | /ai/anomalies | ✅ | AI anomaly detection |
| POST | /ai/forecast | ✅ | 1-hour trend forecast |
| POST | /ai/alert-summary | ✅ | AI alert triage |
| POST | /ai/chat | ✅ | AI chat with system context |
| GET | /ai/status | ✅ | Groq connectivity check |
| GET | /users | ✅ Admin | User list |
| PATCH | /users/{id}/role | ✅ Admin | Change user role |
| GET | /settings | ✅ | System config |
| PUT | /settings | ✅ Admin | Update config |
| WS | /ws/logs?token=... | ✅ | Live log stream |

---

## Environment Variables

```bash
# Required
SECRET_KEY=your-strong-secret-key
GROQ_API_KEY=your-groq-api-key        # free at console.groq.com

# Optional — services fall back to mock data if not set
DATABASE_URL=sqlite:///./ai_log_analyzer.db
ES_HOST=http://localhost:9200
KAFKA_BROKERS=localhost:9092
REDIS_HOST=localhost
```

---

## Features

- ✅ JWT auth with role-based access (viewer / analyst / admin)
- ✅ WebSocket live log stream with level filter, search, pause, export
- ✅ Dashboard with KPI cards, area/bar charts, real alerts, infra cards
- ✅ AI System Analysis — Groq LLM health analysis with findings & recommendations
- ✅ AI Anomaly Detection — pattern detection across all infrastructure metrics
- ✅ AI Trend Forecast — 1-hour prediction for key metrics
- ✅ AI Alert Triage — priority ordering of open alerts
- ✅ AI Chat Assistant — free-form Q&A with live system context
- ✅ Automatic alert detection engine (12 rules, 30-min dedup window)
- ✅ Full alert lifecycle (open → acknowledge → resolve → delete)
- ✅ System Health page — ES indices, Kafka lag, Redis keyspace
- ✅ User management — list, role changes, delete (admin only)
- ✅ Settings — connection config, connection testing, reset to defaults
- ✅ Graceful mock fallbacks — works without ES/Kafka/Redis/Groq
- ✅ Docker Compose with ES, Kafka, Redis, Zookeeper
- ✅ One-command deploy via render.yaml + vercel.json
