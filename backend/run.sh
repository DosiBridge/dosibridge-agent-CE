#!/bin/bash
# Convenience script to run ai_mcp_dynamic.py with the correct environment

cd "$(dirname "$0")"

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Run with uv
uv run --no-project python examples/ai_mcp_dynamic.py "$@"

