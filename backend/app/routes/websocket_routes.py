import asyncio
import json
import random
from datetime import datetime

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Query
from jose import jwt, JWTError

from app.auth.jwt_handler import SECRET_KEY, ALGORITHM

router = APIRouter(tags=["WebSocket"])

LOG_LEVELS = ["INFO", "INFO", "INFO", "WARNING", "ERROR", "CRITICAL"]
SERVICES   = ["auth-service", "api-gateway", "ml-engine", "kafka-consumer", "db-proxy", "redis-cache"]
MESSAGES   = [
    "Request processed successfully",
    "Database query took 234ms",
    "Cache miss — fetching from primary",
    "JWT token validated for user session",
    "Anomaly score: 0.87 — flagging for review",
    "Rate limit threshold approaching for IP 10.0.0.14",
    "Elasticsearch indexing complete: 4200 docs",
    "Kafka consumer offset committed",
    "Model inference completed in 12ms",
    "SSL handshake failed — connection dropped",
    "Memory usage spike detected: 94%",
    "Auto-scaling triggered: +2 instances",
]


@router.websocket("/ws/logs")
async def websocket_logs(websocket: WebSocket, token: str = Query(...)):
    # Must accept BEFORE closing — some clients need this for proper close handshake
    await websocket.accept()

    try:
        jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except JWTError:
        await websocket.send_text(json.dumps({"error": "Invalid or expired token"}))
        await websocket.close(code=1008)
        return

    try:
        while True:
            log_entry = {
                "id":        random.randint(100000, 999999),
                "timestamp": datetime.utcnow().isoformat(),
                "level":     random.choice(LOG_LEVELS),
                "service":   random.choice(SERVICES),
                "message":   random.choice(MESSAGES),
                "ip":        f"10.{random.randint(0,255)}.{random.randint(0,255)}.{random.randint(1,254)}",
            }
            await websocket.send_text(json.dumps(log_entry))
            await asyncio.sleep(random.uniform(0.3, 1.5))
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
