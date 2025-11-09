#!/bin/bash
# Start the FastAPI server

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "🚀 Starting AI MCP Agent Server..."
echo "📡 Server will be available at: http://localhost:8000"
echo "🌐 Open your browser to start chatting!"
echo ""

# Run with uv
uv run --no-project python -m uvicorn src.api:app --host 0.0.0.0 --port 8000 --reload

