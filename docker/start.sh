#!/bin/bash
set -e

PORT=${PORT:-7860}

echo "=========================================================="
echo " Starting LivingDocs Unified Backend (AI Engine + Spring) "
echo " Target Port: $PORT"
echo "=========================================================="

# 1. Khởi động AI Engine (FastAPI) trên cổng nội bộ 8000
echo "[1/2] Starting AI Engine (FastAPI) on 127.0.0.1:8000..."
cd /app/ai-engine
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 &
AI_PID=$!

echo "Waiting for AI Engine to initialize..."
for i in $(seq 1 30); do
  if curl -s http://127.0.0.1:8000/docs > /dev/null 2>&1; then
    echo "AI Engine is READY!"
    break
  fi
  sleep 1
done

# 2. Khởi động Spring Boot Backend
echo "[2/2] Starting LivingDocs Backend (Spring Boot) on 0.0.0.0:$PORT..."
cd /app
exec java -XX:+UseContainerSupport -XX:MaxRAMPercentage=75.0 \
  -Dserver.port=$PORT \
  -Dserver.address=0.0.0.0 \
  -Dai.engine.url=http://127.0.0.1:8000 \
  -jar backend.jar
