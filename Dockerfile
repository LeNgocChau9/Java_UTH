# ==============================================================================
# LivingDocs - All-in-One Cloud Dockerfile (Hugging Face Spaces / Koyeb / Render)
# Runs both FastAPI (AI Engine) & Spring Boot Backend in a single container.
# ==============================================================================

# --- Stage 1: Build Spring Boot JAR ---
FROM maven:3.9.6-eclipse-temurin-17-alpine AS backend-builder
WORKDIR /build

COPY livingdocs-backend/pom.xml .
# Cache dependency layer
RUN mvn dependency:go-offline -B || true

COPY livingdocs-backend/src ./src
RUN mvn clean package -DskipTests

# --- Stage 2: Runtime Environment (Python 3.11 + Java 17 Headless) ---
FROM python:3.11-slim-bookworm

ENV DEBIAN_FRONTEND=noninteractive \
    PYTHONUNBUFFERED=1 \
    PORT=7860

# Install Java 17 headless runtime, curl and netcat
RUN apt-get update && apt-get install -y --no-install-recommends \
    openjdk-17-jre-headless \
    curl \
    netcat-traditional \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1. Setup AI Engine (FastAPI)
COPY livingdocs-ai-engine/requirements.txt ./ai-engine/
RUN pip install --no-cache-dir -r ./ai-engine/requirements.txt
COPY livingdocs-ai-engine ./ai-engine

# 2. Setup Spring Boot Backend
COPY --from=backend-builder /build/target/*.jar ./backend.jar

# 3. Setup Startup Script
COPY docker/start.sh /app/start.sh
RUN chmod +x /app/start.sh

# Hugging Face Spaces runs with UID 1000 ("user")
RUN useradd -m -u 1000 user && chown -R user:user /app
USER user

EXPOSE 7860

CMD ["/app/start.sh"]
