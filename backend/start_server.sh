#!/bin/bash
# Start the FastAPI server

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    set -a
    source .env
    set +a
fi

# Set PYTHONPATH
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Set default CORS_ORIGINS for local development if not already set
if [ -z "$CORS_ORIGINS" ]; then
    export CORS_ORIGINS="http://localhost:3000,http://127.0.0.1:3000,http://localhost:8086,http://127.0.0.1:8086"
    echo "🌐 CORS_ORIGINS not set, using default for local development: $CORS_ORIGINS"
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv .venv
fi

# Activate virtual environment
source .venv/bin/activate

# Check and install dependencies
echo "📦 Checking dependencies..."
MISSING_DEPS=false
if ! python -c "import fastapi" 2>/dev/null; then
    MISSING_DEPS=true
fi
if ! python -c "import uvicorn" 2>/dev/null; then
    MISSING_DEPS=true
fi
if ! python -c "import slowapi" 2>/dev/null; then
    MISSING_DEPS=true
fi

if [ "$MISSING_DEPS" = true ]; then
    echo "📦 Installing dependencies from requirements.txt..."
    pip install -q -r requirements.txt 2>&1 | grep -v "already satisfied" || true
    echo "✓ Dependencies installed"
else
    echo "✓ All dependencies are installed"
fi

echo "🚀 Starting AI MCP Agent Server..."
echo "📡 Server will be available at: http://localhost:8000"
echo "🌐 API docs available at: http://localhost:8000/docs"
echo ""

# Run the server
# --reload enables auto-reload on file changes (development mode)
# --log-level warning reduces verbosity of reload messages
python -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload --log-level warning

