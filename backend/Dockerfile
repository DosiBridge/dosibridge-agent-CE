# syntax=docker/dockerfile:1

# --- Base image ---
ARG PYTHON_VERSION=3.11.6
FROM python:${PYTHON_VERSION}-slim

# --- Environment ---
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

# --- Create non-root user ---
# Use UID 1000 to match typical host user (can be overridden with --build-arg UID=...)
ARG UID=1000
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

# --- Install system dependencies ---
RUN apt-get update && \
    apt-get install -y \
    gcc \
    curl \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# --- Set working directory ---
WORKDIR /app

# --- Copy dependencies and install ---
COPY requirements.txt .
RUN python -m pip install --upgrade pip setuptools wheel && \
    python -m pip install --no-cache-dir -r requirements.txt

# --- Copy project files ---
COPY . .

# --- Expose port ---
EXPOSE 8000

# --- Healthcheck ---
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# --- Switch to non-root user ---
USER appuser

# --- Run application ---
CMD ["python", "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
