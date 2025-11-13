# Agent DosiBridge Backend

A FastAPI-based AI agent backend with RAG, MCP tools, and conversation memory.

## Architecture

See [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture documentation.

## Quick Start

### Prerequisites

- Python 3.11+
- PostgreSQL 15+
- Docker and Docker Compose (optional)

### Installation

1. Install dependencies:

```bash
pip install -r requirements.txt
```

2. Set up environment variables (see `.env.example`):

```bash
cp .env.example .env
# Edit .env with your configuration
```

3. Initialize database:

```bash
python init_db.py
```

4. Run the server:

```bash
python -m uvicorn src.api:app --reload
```

Or use Docker Compose:

```bash
docker-compose up
```

## Project Structure

```
backend/
├── src/
│   ├── core/          # Core domain models and database
│   ├── services/      # Business logic layer
│   ├── api/           # API layer (FastAPI routes)
│   ├── mcp/           # MCP server implementations
│   └── utils/         # Shared utilities
├── init_db.py         # Database initialization
└── requirements.txt   # Python dependencies
```

## Features

- **RAG System**: Retrieval Augmented Generation with FAISS vectorstore
- **MCP Integration**: Model Context Protocol server support
- **Authentication**: JWT-based authentication
- **Rate Limiting**: Built-in rate limiting for API endpoints
- **Streaming**: Server-Sent Events for real-time chat responses
- **Multi-LLM Support**: OpenAI, Gemini, Groq, Ollama

## Environment Variables

See `.env.example` for all required environment variables.

## Development

The project follows a clean architecture pattern with clear separation of concerns:

- **Core**: Domain models, database, configuration
- **Services**: Business logic
- **API**: HTTP endpoints and middleware
- **MCP**: MCP server implementations
- **Utils**: Shared utilities

## License

MIT
