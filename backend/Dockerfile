# syntax=docker/dockerfile:1

# ============================================================================
# Stage 1: Builder - Install dependencies and build Python packages
# ============================================================================
ARG PYTHON_VERSION=3.11.6
FROM python:${PYTHON_VERSION}-slim as builder

# Set build arguments
ARG BUILDPLATFORM
ARG TARGETPLATFORM

# Install build dependencies
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    python3-dev \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Set working directory
WORKDIR /app

# Upgrade pip and install build tools
RUN python -m pip install --upgrade --no-cache-dir pip setuptools wheel

# Copy requirements file
COPY requirements.txt .

# Install Python dependencies to a specific directory for copying
RUN --mount=type=cache,target=/root/.cache/pip \
    python -m pip install --no-cache-dir --prefix=/install -r requirements.txt

# ============================================================================
# Stage 2: Runtime - Minimal production image
# ============================================================================
FROM python:${PYTHON_VERSION}-slim as runtime

# Set environment variables
ENV PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    PORT=8000

# Install only runtime dependencies (no build tools)
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
ARG UID=1000
RUN adduser \
    --disabled-password \
    --gecos "" \
    --home "/home/appuser" \
    --shell "/sbin/nologin" \
    --uid "${UID}" \
    appuser

# Set working directory
WORKDIR /app

# Copy installed packages from builder stage
COPY --from=builder /install /usr/local

# Copy application code
COPY --chown=appuser:appuser . .

# Expose port
EXPOSE 8000

# Healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

# Switch to non-root user
USER appuser

# Run application
CMD ["python", "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]
