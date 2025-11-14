# DosiBridge Agent - Architecture Documentation

## Table of Contents

1. [Overview](#overview)
2. [System Architecture](#system-architecture)
3. [Backend Architecture](#backend-architecture)
4. [Frontend Architecture](#frontend-architecture)
5. [Data Flow](#data-flow)
6. [Key Components](#key-components)
7. [Technology Stack](#technology-stack)
8. [Database Schema](#database-schema)
9. [API Endpoints](#api-endpoints)
10. [Security](#security)
11. [Deployment](#deployment)

---

## Overview

**DosiBridge Agent** is an intelligent AI-powered assistant platform that combines:

- **RAG (Retrieval Augmented Generation)**: Document-based question answering with vector search
- **Agent Mode**: Tool-using AI agents with MCP (Model Context Protocol) integration
- **Multi-LLM Support**: OpenAI, Google Gemini, Groq, and Ollama
- **Real-time Streaming**: Server-Sent Events (SSE) for live chat responses
- **User Authentication**: JWT-based secure authentication
- **Session Management**: Persistent conversation history

The system follows a **clean architecture** pattern with clear separation of concerns between the API layer, business logic, and data persistence.

---

## System Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                    │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐      │
│  │   React UI   │  │   Zustand    │  │   API Client │      │
│  │  Components  │  │   State Mgmt │  │   (fetch)    │      │
│  └──────────────┘  └──────────────┘  └──────────────┘      │
└────────────────────────────┬────────────────────────────────┘
                             │ HTTP/SSE
                             │
┌────────────────────────────┴────────────────────────────────┐
│                    Backend (FastAPI)                         │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              API Layer (Routes)                      │   │
│  │  ┌────────┐ ┌────────┐ ┌────────┐ ┌──────────────┐ │   │
│  │  │  Chat  │ │  Auth  │ │  Docs  │ │  MCP/Sessions│ │   │
│  │  └────────┘ └────────┘ └────────┘ └──────────────┘ │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │            Service Layer (Business Logic)            │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │   Chat   │ │   RAG    │ │  Agent   │            │   │
│  │  │ Service  │ │  System  │ │ Service  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └──────────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────────┐   │
│  │              Core Layer (Domain Models)              │   │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐            │   │
│  │  │ Database │ │   Auth   │ │  Config  │            │   │
│  │  └──────────┘ └──────────┘ └──────────┘            │   │
│  └──────────────────────────────────────────────────────┘   │
└────────────────────────────┬────────────────────────────────┘
                             │
        ┌────────────────────┼────────────────────┐
        │                    │                    │
┌───────▼──────┐   ┌─────────▼─────────┐  ┌──────▼──────┐
│  PostgreSQL  │   │  FAISS Vectorstore│  │  MCP Servers│
│   Database   │   │   (Per User)      │  │  (External) │
└──────────────┘   └───────────────────┘  └─────────────┘
```

---

## Backend Architecture

### Directory Structure

```
backend/
├── src/
│   ├── core/                    # Core domain layer
│   │   ├── config.py           # Configuration management
│   │   ├── database.py         # Database connection & session management
│   │   ├── models.py           # SQLAlchemy ORM models
│   │   ├── auth.py             # Authentication & authorization
│   │   ├── constants.py        # Application constants
│   │   └── env_validation.py   # Environment variable validation
│   │
│   ├── services/                # Business logic layer
│   │   ├── chat_service.py     # Chat orchestration
│   │   ├── agent.py            # Agent creation & execution
│   │   ├── react_agent.py      # ReAct agent implementation
│   │   ├── rag.py              # Basic RAG system
│   │   ├── advanced_rag.py     # Advanced RAG with hybrid search
│   │   ├── llm_factory.py      # LLM instance creation
│   │   ├── mcp_client.py       # MCP client management
│   │   ├── history.py          # In-memory history (fallback)
│   │   ├── db_history.py       # Database-backed history
│   │   ├── document_processor.py # Document parsing & chunking
│   │   └── tools.py            # Custom tool definitions
│   │
│   ├── api/                     # API layer
│   │   ├── __init__.py         # FastAPI app initialization
│   │   ├── routes/             # API route handlers
│   │   │   ├── chat.py         # Chat endpoints (streaming/non-streaming)
│   │   │   ├── auth.py         # Authentication endpoints
│   │   │   ├── documents.py    # Document upload & management
│   │   │   ├── sessions.py     # Session management
│   │   │   ├── tools.py        # Tool listing
│   │   │   ├── mcp_servers.py  # MCP server CRUD
│   │   │   ├── llm_config.py   # LLM configuration
│   │   │   ├── websocket.py    # WebSocket support
│   │   │   └── custom_rag_tools.py # Custom RAG tools
│   │   ├── models.py           # Pydantic request/response models
│   │   ├── dependencies.py     # FastAPI dependencies
│   │   ├── middleware.py       # Custom middleware (logging, request ID)
│   │   ├── exceptions.py       # Custom exception handlers
│   │   └── validators.py       # Input validation
│   │
│   ├── mcp/                     # MCP server implementations
│   │   ├── registry.py         # MCP server registry
│   │   ├── weather.py          # Weather MCP server
│   │   ├── math_server.py      # Math MCP server
│   │   ├── web.py              # Web scraping MCP server
│   │   └── people.py           # People/contacts MCP server
│   │
│   ├── utils/                   # Shared utilities
│   │   ├── logger.py           # Structured logging
│   │   ├── encryption.py       # Data encryption (MCP API keys)
│   │   ├── cache.py            # Caching utilities
│   │   ├── rate_limiter.py     # Rate limiting helpers
│   │   └── validators.py       # Validation utilities
│   │
│   └── vectorstores/            # FAISS vector stores (per user)
│       └── user_{id}/
│           ├── index.faiss
│           └── index.pkl
│
├── init_db.py                   # Database initialization script
├── requirements.txt             # Python dependencies
└── Dockerfile                   # Docker image definition
```

### Core Layer

**Purpose**: Domain models, database configuration, and core business rules.

#### Key Components:

1. **`core/config.py`**

   - Loads LLM configuration from database (with env fallback)
   - Loads MCP servers (user-specific, private)
   - Manages application-wide settings

2. **`core/database.py`**

   - SQLAlchemy engine and session management
   - Database initialization and migrations
   - Context managers for transaction handling

3. **`core/models.py`**

   - SQLAlchemy ORM models:
     - `User`: User accounts
     - `LLMConfig`: LLM provider configurations
     - `MCPServer`: MCP server configurations (user-specific)
     - `Conversation`: Chat sessions
     - `Message`: Individual messages
     - `DocumentCollection`: Document collections
     - `Document`: Uploaded documents
     - `DocumentChunk`: Document chunks for RAG

4. **`core/auth.py`**
   - JWT token generation and validation
   - Password hashing (bcrypt)
   - User authentication dependencies

### Service Layer

**Purpose**: Business logic and orchestration.

#### Key Services:

1. **`ChatService`** (`services/chat_service.py`)

   - Orchestrates chat processing
   - Routes to Agent or RAG mode
   - Handles streaming responses

2. **`AdvancedRAGSystem`** (`services/advanced_rag.py`)

   - Hybrid search (vector + BM25)
   - Re-ranking with cross-encoder
   - Per-user vector stores
   - Dynamic retrieval (adaptive k)

3. **`AgentService`** (`services/agent.py`)

   - Creates LangChain agents
   - Integrates MCP tools
   - Manages tool execution

4. **`MCPClientManager`** (`services/mcp_client.py`)

   - Manages MCP server connections
   - Loads tools from MCP servers
   - Handles user-specific MCP configurations

5. **`LLMFactory`** (`services/llm_factory.py`)
   - Creates LLM instances from config
   - Supports OpenAI, Gemini, Groq, Ollama
   - Handles streaming configuration

### API Layer

**Purpose**: HTTP endpoints, request/response handling, middleware.

#### Key Routes:

1. **`/api/chat`** & **`/api/chat/stream`**

   - Non-streaming and streaming chat endpoints
   - Supports Agent and RAG modes
   - Handles session management

2. **`/api/auth/*`**

   - User registration and login
   - JWT token generation

3. **`/api/documents/*`**

   - Document upload
   - Collection management
   - Document processing status

4. **`/api/sessions/*`**

   - Session CRUD operations
   - Conversation history retrieval

5. **`/api/mcp-servers/*`**

   - MCP server configuration (user-specific)
   - Server CRUD operations

6. **`/api/llm-config`**
   - LLM provider configuration
   - Model switching

---

## Frontend Architecture

### Directory Structure

```
frontend/
├── app/                         # Next.js App Router
│   ├── layout.tsx              # Root layout
│   ├── page.tsx                # Landing page
│   ├── login/                  # Login page
│   ├── register/               # Registration page
│   ├── chat/                   # Chat interface
│   │   └── page.tsx
│   ├── api/                    # API routes (runtime config, health)
│   │   ├── health/
│   │   └── runtime-config/
│   └── globals.css             # Global styles
│
├── components/                  # React components
│   ├── ChatWindow.tsx          # Message display area
│   ├── ChatInput.tsx           # Message input with mode selector
│   ├── MessageBubble.tsx       # Individual message component
│   ├── SessionSidebar.tsx      # Session management sidebar
│   ├── SettingsPanel.tsx       # Settings modal
│   ├── DocumentUpload.tsx      # Document upload component
│   ├── RAGSettings.tsx         # RAG configuration
│   ├── HealthStatus.tsx        # Backend health indicator
│   └── ui/                     # Reusable UI components
│       ├── Button.tsx
│       ├── Modal.tsx
│       ├── Toast.tsx
│       └── ...
│
├── lib/                         # Utilities and helpers
│   ├── api.ts                  # API client functions
│   ├── store.ts                # Zustand state management
│   ├── websocket.ts            # WebSocket client
│   ├── cache.ts                # Client-side caching
│   └── utils.ts                # General utilities
│
├── hooks/                       # Custom React hooks
│   ├── useAutoResize.ts
│   ├── useDebounce.ts
│   ├── useLocalStorage.ts
│   └── ...
│
└── types/                       # TypeScript type definitions
    └── routes.d.ts
```

### Key Components

1. **`ChatWindow`**

   - Displays message history
   - Handles streaming message updates
   - Markdown rendering

2. **`ChatInput`**

   - Message input field
   - Mode selector (Agent/RAG)
   - Send button and keyboard shortcuts

3. **`SessionSidebar`**

   - Lists all user sessions
   - Create/delete sessions
   - Session switching

4. **`SettingsPanel`**
   - MCP server configuration
   - LLM provider settings
   - Tool management

### State Management

**Zustand Store** (`lib/store.ts`):

- Chat messages
- Current session
- UI state (sidebar, settings)
- Backend health status

### API Client

**`lib/api.ts`**:

- Centralized API client
- Handles authentication tokens
- SSE streaming support
- Error handling and retries

---

## Data Flow

### Chat Request Flow (Agent Mode)

```
1. User sends message via ChatInput
   ↓
2. Frontend: POST /api/chat/stream
   ↓
3. Backend: chat.py → ChatService.process_chat()
   ↓
4. ChatService: Loads LLM config, MCP servers, history
   ↓
5. AgentService: Creates LangChain agent with tools
   ↓
6. MCPClientManager: Loads tools from MCP servers
   ↓
7. Agent executes: Tool calls → LLM → Response
   ↓
8. Streaming: SSE events sent to frontend
   ↓
9. Frontend: Updates ChatWindow with streaming text
   ↓
10. Backend: Saves message to database (background)
```

### Chat Request Flow (RAG Mode)

```
1. User sends message via ChatInput
   ↓
2. Frontend: POST /api/chat/stream
   ↓
3. Backend: chat.py → ChatService.process_chat()
   ↓
4. ChatService: Routes to AdvancedRAGSystem
   ↓
5. AdvancedRAGSystem.retrieve():
   - Loads user's vectorstore
   - Performs hybrid search (vector + BM25)
   - Re-ranks results (optional)
   ↓
6. Builds context from retrieved documents
   ↓
7. LLM generates answer with context
   ↓
8. Streaming: SSE events sent to frontend
   ↓
9. Frontend: Updates ChatWindow
   ↓
10. Backend: Saves message to database
```

### Document Upload Flow

```
1. User uploads document via DocumentUpload
   ↓
2. Frontend: POST /api/documents/upload
   ↓
3. Backend: documents.py → DocumentProcessor
   ↓
4. DocumentProcessor:
   - Parses document (PDF, DOCX, etc.)
   - Chunks text
   - Generates embeddings
   ↓
5. Saves to database (Document, DocumentChunk)
   ↓
6. Updates FAISS vectorstore
   ↓
7. Returns document ID and status
```

---

## Key Components

### RAG System

**Features**:

- **Hybrid Search**: Combines vector similarity (FAISS) with keyword search (BM25)
- **Re-ranking**: Cross-encoder model for improved relevance
- **Per-User Isolation**: Each user has their own vectorstore
- **Collection Support**: Documents organized into collections
- **Dynamic Retrieval**: Adaptive k based on query complexity

**Storage**:

- Vector embeddings: FAISS index (per user)
- Metadata: PostgreSQL (documents, chunks, collections)

### Agent System

**Features**:

- **Tool Integration**: MCP servers + local tools
- **ReAct Pattern**: Reasoning and acting in language model
- **Multi-LLM**: Works with any LangChain-compatible LLM
- **Streaming**: Real-time tool execution updates

**Tools**:

- MCP tools (from configured servers)
- Local tools (document retrieval, custom RAG tools)
- LLM-native tools (function calling)

### MCP Integration

**Model Context Protocol (MCP)**:

- Standardized protocol for tool integration
- User-specific server configurations
- Encrypted API keys
- Dynamic tool loading

**Supported Connection Types**:

- HTTP/HTTPS
- SSE (Server-Sent Events)
- stdio (for local servers)

---

## Technology Stack

### Backend

- **Framework**: FastAPI 0.115+
- **Database**: PostgreSQL 15+ (SQLAlchemy ORM)
- **Vector Store**: FAISS (CPU/GPU)
- **LLM Libraries**:
  - LangChain / LangGraph
  - langchain-openai
  - langchain-google-genai
  - langchain-ollama
- **MCP**: `mcp>=1.20.0`, `fastmcp>=2.13.0`
- **Authentication**: python-jose, passlib, bcrypt
- **Document Processing**: pypdf2, python-docx, unstructured
- **RAG Enhancements**: sentence-transformers, rank-bm25
- **Rate Limiting**: slowapi

### Frontend

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript 5+
- **UI Library**: React 19
- **Styling**: TailwindCSS v4
- **State Management**: Zustand
- **HTTP Client**: Fetch API (native)
- **SSE**: EventSource API
- **Markdown**: react-markdown
- **Notifications**: react-hot-toast
- **Icons**: Lucide React

### Infrastructure

- **Containerization**: Docker, Docker Compose
- **Database**: PostgreSQL (containerized)
- **Reverse Proxy**: (Optional) Nginx

---

## Database Schema

### Core Tables

#### `users`

- `id` (PK)
- `username` (unique)
- `email` (unique)
- `hashed_password`
- `is_active`
- `created_at`, `updated_at`

#### `llm_config`

- `id` (PK)
- `user_id` (FK, nullable - system-wide configs)
- `type` (openai, gemini, groq, ollama)
- `model`
- `api_key` (encrypted)
- `base_url`
- `active` (boolean)
- `created_at`, `updated_at`

#### `mcp_servers`

- `id` (PK)
- `user_id` (FK, required - user-specific)
- `name` (unique per user)
- `url`
- `api_key` (encrypted, optional)
- `connection_type` (http, sse, stdio)
- `headers` (JSON, optional)
- `enabled` (boolean)
- `created_at`, `updated_at`

#### `conversations`

- `id` (PK)
- `user_id` (FK)
- `session_id` (unique per user)
- `title`
- `summary`
- `message_count`
- `created_at`, `updated_at`

#### `messages`

- `id` (PK)
- `conversation_id` (FK)
- `role` (user, assistant, system)
- `content`
- `tool_calls` (JSON, optional)
- `created_at`

#### `document_collections`

- `id` (PK)
- `user_id` (FK)
- `name` (unique per user)
- `description`
- `created_at`, `updated_at`

#### `documents`

- `id` (PK)
- `user_id` (FK)
- `collection_id` (FK, nullable)
- `filename`
- `original_filename`
- `file_path`
- `file_type`
- `file_size`
- `status` (pending, processing, completed, failed)
- `document_metadata` (JSON)
- `chunk_count`
- `embedding_status` (pending, completed, failed)
- `created_at`, `updated_at`

#### `document_chunks`

- `id` (PK)
- `document_id` (FK)
- `chunk_index`
- `content`
- `chunk_metadata` (JSON)
- `embedding` (base64-encoded vector)
- `created_at`

---

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login (returns JWT)
- `GET /api/auth/me` - Get current user info

### Chat

- `POST /api/chat` - Non-streaming chat
- `POST /api/chat/stream` - Streaming chat (SSE)

### Sessions

- `GET /api/sessions` - List all sessions
- `GET /api/session/{id}` - Get session details
- `DELETE /api/session/{id}` - Delete session

### Documents

- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete document
- `GET /api/collections` - List collections
- `POST /api/collections` - Create collection
- `DELETE /api/collections/{id}` - Delete collection

### MCP Servers

- `GET /api/mcp-servers` - List MCP servers (user-specific)
- `POST /api/mcp-servers` - Add MCP server
- `PUT /api/mcp-servers/{name}` - Update MCP server
- `DELETE /api/mcp-servers/{name}` - Delete MCP server

### LLM Configuration

- `GET /api/llm-config` - Get current LLM config
- `POST /api/llm-config` - Set LLM config

### Tools

- `GET /api/tools` - List available tools

### Health

- `GET /health` - Health check

---

## Security

### Authentication & Authorization

- **JWT Tokens**: Stateless authentication
- **Password Hashing**: bcrypt with salt
- **User Isolation**: All data scoped by `user_id`
- **MCP Servers**: User-specific, private (no cross-user access)

### Data Protection

- **API Key Encryption**: MCP server API keys encrypted at rest
- **SQL Injection Prevention**: SQLAlchemy ORM (parameterized queries)
- **CORS**: Configurable allowed origins
- **Rate Limiting**: Per-IP rate limits (slowapi)

### Best Practices

- Environment variables for secrets
- No hardcoded credentials
- Database connection pooling
- Input validation (Pydantic models)
- Error handling without exposing internals

---

## Deployment

### Docker Compose

The project includes a `docker-compose.yml` with three services:

1. **PostgreSQL Database** (`db`)

   - Port: 5432
   - Persistent volume: `pgdata`

2. **Backend API** (`agent-backend`)

   - Port: 8085 (mapped to 8000)
   - Depends on: `db`
   - Environment variables for API keys

3. **Frontend** (`agent-frontend`)
   - Port: 8086 (mapped to 3000)
   - Depends on: `agent-backend`
   - Build-time: `NEXT_PUBLIC_API_BASE_URL`

### Environment Variables

**Backend**:

- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET_KEY`: Secret for JWT signing
- `OPENAI_API_KEY`: OpenAI API key (optional)
- `GOOGLE_API_KEY`: Google API key (optional)
- `GROQ_API_KEY`: Groq API key (optional)
- `CORS_ORIGINS`: Comma-separated allowed origins

**Frontend**:

- `NEXT_PUBLIC_API_BASE_URL`: Backend API URL

### Local Development

**Backend**:

```bash
cd backend
pip install -r requirements.txt
python init_db.py
python -m uvicorn src.api:app --reload
```

**Frontend**:

```bash
cd frontend
npm install
npm run dev
```

### Production Deployment

1. Set environment variables
2. Build Docker images: `docker-compose build`
3. Start services: `docker-compose up -d`
4. Initialize database: `docker-compose exec agent-backend python init_db.py`

---

## Architecture Principles

1. **Separation of Concerns**: Clear boundaries between API, services, and data layers
2. **User Isolation**: All user data scoped by `user_id`
3. **Extensibility**: Plugin-based MCP server integration
4. **Performance**: Streaming responses, connection pooling, caching
5. **Security**: Encryption, authentication, input validation
6. **Scalability**: Stateless API, per-user vector stores, database indexing

---

## Future Enhancements

- [ ] WebSocket support for bidirectional communication
- [ ] Multi-modal support (images, audio)
- [ ] Advanced RAG techniques (query expansion, multi-hop retrieval)
- [ ] Agent memory and planning
- [ ] Analytics and monitoring
- [ ] Multi-tenant support
- [ ] API rate limiting per user
- [ ] Document versioning

---

## Contributing

When contributing, please follow the architecture patterns:

1. **API Layer**: Handle HTTP concerns only
2. **Service Layer**: Implement business logic
3. **Core Layer**: Domain models and database
4. **Utils**: Shared utilities (no business logic)

---

## License

MIT
