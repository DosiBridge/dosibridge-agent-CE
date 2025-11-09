#!/bin/bash
# Start the FastAPI server

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Set PYTHONPATH
export PYTHONPATH="$(pwd):$PYTHONPATH"

# Create virtual environment if it doesn't exist
if [ ! -d "venv" ]; then
    echo "📦 Creating virtual environment..."
    python -m venv venv
fi

# Activate virtual environment
source venv/bin/activate

# Install dependencies if needed
if ! python -c "import uvicorn" 2>/dev/null; then
    echo "📦 Installing dependencies..."
    pip install -q -r requirements.txt 2>&1 | grep -v "already satisfied" || true
fi

echo "🚀 Starting AI MCP Agent Server..."
echo "📡 Server will be available at: http://localhost:8000"
echo "🌐 API docs available at: http://localhost:8000/docs"
echo ""

# Run the server
python -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload

