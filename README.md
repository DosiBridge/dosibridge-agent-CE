# Agent DosiBridge

A full-stack AI agent platform with Retrieval Augmented Generation (RAG), Model Context Protocol (MCP) integration, and multi-LLM support. Built with FastAPI backend and Next.js frontend, featuring a ChatGPT-like interface with streaming responses, document management, and advanced RAG capabilities.

## 🚀 Features

### Core Capabilities

- **🤖 Multi-LLM Support**: Switch between OpenAI (GPT-4o), Google Gemini, Groq, and Ollama models
- **💬 Streaming Chat**: Real-time character-by-character streaming responses using Server-Sent Events (SSE)
- **📚 Advanced RAG System**:
  - Hybrid search (Vector + BM25)
  - Cross-encoder re-ranking
  - Multiple document collections per user
  - Per-user vectorstores with FAISS
- **🔌 MCP Integration**: Model Context Protocol server support for extensible tooling
- **🔐 Authentication**: JWT-based user authentication with secure password hashing
- **📝 Document Management**: Upload, organize, and query documents with collection support
- **💾 Session Management**: Persistent conversation history with session switching
- **⚡ Rate Limiting**: Built-in API rate limiting for production use
- **🌐 WebSocket Support**: Real-time bidirectional communication

### Frontend Features

- **🎨 Modern UI**: ChatGPT-inspired design with dark mode support
- **📊 Health Monitoring**: Real-time backend health status and MCP server count
- **⚙️ Settings Panel**: Configure MCP servers and LLM settings through intuitive UI
- **🔍 Dual Modes**: Switch between Agent mode (with tools) and RAG mode
- **📝 Markdown Support**: Rich text rendering with code blocks and formatting
- **📱 Responsive Design**: Works seamlessly on desktop and mobile devices

## 📋 Table of Contents

- [Architecture](#architecture)
- [Tech Stack](#tech-stack)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Usage](#usage)
- [Project Structure](#project-structure)
- [API Documentation](#api-documentation)
- [Development](#development)
- [Deployment](#deployment)
- [Security](#security)
- [Contributing](#contributing)
- [License](#license)

## 🏗️ Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                        Frontend (Next.js)                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Chat UI    │  │  Documents   │  │   Settings   │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
                    HTTP/WebSocket/SSE
                            │
┌─────────────────────────────────────────────────────────────┐
│                    Backend (FastAPI)                        │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │  Chat Service│  │  RAG System  │  │  MCP Client  │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │
│  │   Auth       │  │  Document    │  │  LLM Factory │       │
│  │   Service    │  │  Processor   │  │              │       │
│  └──────────────┘  └──────────────┘  └──────────────┘       │
└─────────────────────────────────────────────────────────────┘
                            │
        ┌───────────────────┼───────────────────┐
        │                   │                   │
┌───────▼──────┐  ┌─────────▼─────────┐  ┌─────▼──────┐
│  PostgreSQL  │  │  FAISS Vectorstore│  │  MCP       │
│  Database    │  │  (Per User)       │  │  Servers   │
└──────────────┘  └───────────────────┘  └────────────┘
```

### Backend Architecture

The backend follows a clean architecture pattern with clear separation of concerns:

- **Core Layer**: Domain models, database configuration, authentication
- **Services Layer**: Business logic (RAG, chat, document processing)
- **API Layer**: HTTP endpoints, middleware, request/response models
- **MCP Layer**: Model Context Protocol server implementations and client

### RAG System Architecture

The RAG system uses a hybrid search approach:

1. **Document Storage**: Documents are chunked and stored in PostgreSQL
2. **Vector Embeddings**: Chunks are embedded using OpenAI embeddings
3. **Vector Store**: FAISS vectorstore stores embeddings per user
4. **Retrieval**: Hybrid search combines:
   - Vector similarity search (semantic matching)
   - BM25 keyword search (lexical matching)
   - Cross-encoder re-ranking (relevance scoring)
5. **Collection Filtering**: Documents can be organized into collections for targeted retrieval

For detailed RAG architecture, see [MULTIPLE_COLLECTIONS_RAG.md](./MULTIPLE_COLLECTIONS_RAG.md).

## 🛠️ Tech Stack

### Backend

- **Framework**: FastAPI 0.115+
- **Database**: PostgreSQL 15+ with SQLAlchemy ORM
- **Vector Store**: FAISS (CPU/GPU)
- **LLM Libraries**:
  - LangChain & LangGraph
  - langchain-openai, langchain-google-genai, langchain-ollama
- **MCP**: Model Context Protocol (mcp>=1.20.0)
- **Authentication**: JWT (python-jose), bcrypt
- **Document Processing**: PyPDF2, python-docx, unstructured
- **RAG Components**: sentence-transformers, rank-bm25

### Frontend

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: TailwindCSS v4
- **State Management**: Zustand
- **HTTP Client**: Fetch API with SSE support
- **Markdown**: react-markdown
- **UI Components**: Custom components with Lucide React icons

### Infrastructure

- **Containerization**: Docker & Docker Compose
- **Web Server**: Uvicorn (ASGI)
- **Rate Limiting**: SlowAPI

## 📦 Prerequisites

- **Python**: 3.11 or higher
- **Node.js**: 18 or higher
- **PostgreSQL**: 15 or higher
- **Docker & Docker Compose** (optional, for containerized deployment)

## 🔧 Installation

### Option 1: Docker Compose (Recommended)

1. **Clone the repository**:

   ```bash
   git clone <repository-url>
   cd agent-dosibridge
   ```

2. **Set up environment variables**:

   ```bash
   # Backend environment variables
   cp backend/.env.example backend/.env
   # Edit backend/.env with your configuration

   # Frontend environment variables (optional, defaults work for Docker)
   # NEXT_PUBLIC_API_BASE_URL is set in docker-compose.yml
   ```

3. **Start all services**:

   ```bash
   docker-compose up -d
   ```

   This will start:

   - PostgreSQL database on port 5432
   - Backend API on port 8085
   - Frontend on port 8086

4. **Initialize the database** (first time only):
   ```bash
   docker exec -it agent-backend python init_db.py
   ```

### Option 2: Local Development

#### Backend Setup

1. **Navigate to backend directory**:

   ```bash
   cd backend
   ```

2. **Create virtual environment**:

   ```bash
   python -m venv .venv
   source .venv/bin/activate  # On Windows: .venv\Scripts\activate
   ```

3. **Install dependencies**:

   ```bash
   pip install -r requirements.txt
   ```

4. **Set up environment variables**:

   ```bash
   cp .env.example .env
   # Edit .env with your configuration
   ```

5. **Generate security keys**:

   ```bash
   python generate_keys.py
   ```

   This generates JWT_SECRET_KEY and MCP_APIKEY_ENCRYPTION_KEY. See [KEY_SETUP.md](./backend/KEY_SETUP.md) for details.

6. **Initialize database**:

   ```bash
   python init_db.py
   ```

7. **Start the server**:

   ```bash
   ./start_server.sh
   # Or manually:
   python -m uvicorn src.api:app --reload --host 0.0.0.0 --port 8000
   ```

   The API will be available at `http://localhost:8000`
   API documentation at `http://localhost:8000/docs`

#### Frontend Setup

1. **Navigate to frontend directory**:

   ```bash
   cd frontend
   ```

2. **Install dependencies**:

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Set up environment variables**:

   ```bash
   cp .env.local.example .env.local
   # Edit .env.local with your backend URL
   ```

4. **Start development server**:

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

   The frontend will be available at `http://localhost:3000`

## ⚙️ Configuration

### Environment Variables

#### Backend (.env)

```env
# Database Configuration
DATABASE_URL="postgresql://user:password@localhost:5432/mcpagent"

# JWT Authentication Secret Key (generate with generate_keys.py)
JWT_SECRET_KEY=your-generated-jwt-secret-key-here

# MCP API Key Encryption Key (generate with generate_keys.py)
MCP_APIKEY_ENCRYPTION_KEY=your-generated-encryption-key-here

# CORS Origins (comma-separated)
CORS_ORIGINS="http://localhost:3000,http://localhost:8086"

# LLM API Keys (optional, can be set via UI)
OPENAI_API_KEY=""
GOOGLE_API_KEY=""
GROQ_API_KEY=""

# Environment
ENVIRONMENT="development"
```

#### Frontend (.env.local)

```env
# Backend API URL
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000
```

### Database Schema

The application uses PostgreSQL with the following main tables:

- **users**: User accounts and authentication
- **llm_config**: LLM configuration (per user)
- **mcp_servers**: MCP server configurations (per user)
- **sessions**: Chat session management
- **messages**: Conversation messages
- **document_collections**: Document collections (per user)
- **documents**: Uploaded documents
- **document_chunks**: Document chunks for RAG

### Security Keys

Generate required security keys using:

```bash
cd backend
python generate_keys.py
```

See [backend/KEY_SETUP.md](./backend/KEY_SETUP.md) for detailed security setup instructions.

## 📖 Usage

### Starting the Application

1. **Using Docker Compose**:

   ```bash
   docker-compose up -d
   ```

2. **Access the application**:
   - Frontend: http://localhost:8086 (or http://localhost:3000 in local dev)
   - Backend API: http://localhost:8085 (or http://localhost:8000 in local dev)
   - API Docs: http://localhost:8085/docs

### Basic Workflow

1. **Register/Login**: Create an account or login
2. **Configure LLM**: Go to Settings → LLM Config to set up your preferred model
3. **Upload Documents** (optional): Upload documents to collections for RAG
4. **Start Chatting**:
   - Select mode: Agent (with tools) or RAG (document-based)
   - Type your message and get streaming responses
5. **Manage Sessions**: Create, switch, or delete conversation sessions

### Document Management

1. **Create Collection**: Create a document collection to organize your documents
2. **Upload Documents**: Upload PDF, DOCX, or text files
3. **Query Documents**: Use RAG mode to query your documents
4. **Collection Filtering**: Select a collection to query specific documents

### MCP Servers

1. **Add MCP Server**: Go to Settings → MCP Servers
2. **Configure**: Provide server name, URL, and optional API key
3. **Enable/Disable**: Toggle servers on/off as needed
4. **Use Tools**: MCP tools are automatically available in Agent mode

## 📁 Project Structure

```
agent-dosibridge/
├── backend/
│   ├── src/
│   │   ├── api/              # FastAPI application
│   │   │   ├── routes/       # API route handlers
│   │   │   ├── models.py     # Pydantic models
│   │   │   ├── middleware.py # CORS, rate limiting
│   │   │   └── lifespan.py   # App lifecycle management
│   │   ├── core/             # Core domain layer
│   │   │   ├── models.py     # SQLAlchemy models
│   │   │   ├── database.py   # Database configuration
│   │   │   ├── config.py     # Application config
│   │   │   └── auth.py       # Authentication logic
│   │   ├── services/         # Business logic
│   │   │   ├── chat_service.py
│   │   │   ├── advanced_rag.py
│   │   │   ├── document_processor.py
│   │   │   ├── mcp_client.py
│   │   │   └── llm_factory.py
│   │   ├── mcp/              # MCP server implementations
│   │   └── utils/            # Utilities
│   ├── init_db.py            # Database initialization
│   ├── generate_keys.py      # Security key generation
│   ├── requirements.txt      # Python dependencies
│   └── Dockerfile            # Backend container
│
├── frontend/
│   ├── app/                  # Next.js app directory
│   │   ├── chat/             # Chat page
│   │   ├── login/            # Login page
│   │   └── api/              # API routes
│   ├── components/           # React components
│   │   ├── ChatWindow.tsx
│   │   ├── ChatInput.tsx
│   │   ├── DocumentUpload.tsx
│   │   └── ui/               # UI components
│   ├── lib/                  # Utilities and API clients
│   │   ├── api/              # API client modules
│   │   └── store.ts          # Zustand store
│   ├── types/                # TypeScript types
│   ├── hooks/                # Custom React hooks
│   ├── package.json
│   └── Dockerfile            # Frontend container
│
├── docker-compose.yml        # Docker Compose configuration
├── README.md                 # This file
├── MULTIPLE_COLLECTIONS_RAG.md  # RAG architecture details
└── FRONTEND_STRUCTURE.md     # Frontend structure guide
```

## 📡 API Documentation

### Authentication Endpoints

- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login and get JWT token
- `GET /api/auth/me` - Get current user info

### Chat Endpoints

- `POST /api/chat` - Non-streaming chat
- `POST /api/chat/stream` - Streaming chat (SSE)
- `GET /api/sessions` - List all sessions
- `GET /api/session/{id}` - Get session history
- `DELETE /api/session/{id}` - Delete session

### Document Endpoints

- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `DELETE /api/documents/{id}` - Delete document
- `POST /api/collections` - Create collection
- `GET /api/collections` - List collections

### Configuration Endpoints

- `GET /api/llm-config` - Get LLM configuration
- `POST /api/llm-config` - Set LLM configuration
- `GET /api/mcp-servers` - List MCP servers
- `POST /api/mcp-servers` - Add MCP server
- `PUT /api/mcp-servers/{name}` - Update MCP server
- `DELETE /api/mcp-servers/{name}` - Delete MCP server

### Health & Tools

- `GET /health` - Health check
- `GET /api/tools` - Get available tools

Full API documentation available at `/docs` when the backend is running.

## 🔨 Development

### Backend Development

1. **Activate virtual environment**:

   ```bash
   cd backend
   source .venv/bin/activate
   ```

2. **Run with auto-reload**:

   ```bash
   python -m uvicorn src.api:app --reload
   ```

3. **Run tests** (if available):
   ```bash
   pytest
   ```

### Frontend Development

1. **Start development server**:

   ```bash
   cd frontend
   npm run dev
   ```

2. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

### Code Style

- **Backend**: Follow PEP 8, use type hints
- **Frontend**: Follow ESLint rules, use TypeScript

### Adding New Features

1. **Backend**: Add routes in `backend/src/api/routes/`, services in `backend/src/services/`
2. **Frontend**: Add components in `frontend/components/`, API clients in `frontend/lib/api/`

## 🚢 Deployment

### Docker Deployment

1. **Build images**:

   ```bash
   docker-compose build
   ```

2. **Start services**:

   ```bash
   docker-compose up -d
   ```

3. **View logs**:
   ```bash
   docker-compose logs -f
   ```

### Production Considerations

1. **Environment Variables**: Set all required environment variables
2. **Security Keys**: Generate strong keys for production
3. **Database**: Use managed PostgreSQL service
4. **HTTPS**: Use reverse proxy (nginx) with SSL certificates
5. **Rate Limiting**: Configure appropriate rate limits
6. **Monitoring**: Set up logging and monitoring
7. **Backups**: Regular database backups

## 🔒 Security

### Authentication

- JWT tokens with expiration
- Bcrypt password hashing
- Secure token storage

### Data Protection

- Encrypted MCP API keys in database
- User-specific data isolation
- CORS configuration
- Rate limiting

### Best Practices

- Never commit `.env` files
- Use strong, unique keys per environment
- Keep dependencies updated
- Regular security audits

See [backend/KEY_SETUP.md](./backend/KEY_SETUP.md) for security key setup.

## 📚 Additional Documentation

- [MULTIPLE_COLLECTIONS_RAG.md](./MULTIPLE_COLLECTIONS_RAG.md) - Detailed RAG system architecture
- [FRONTEND_STRUCTURE.md](./FRONTEND_STRUCTURE.md) - Frontend code organization
- [backend/KEY_SETUP.md](./backend/KEY_SETUP.md) - Security key generation guide
- [backend/README.md](./backend/README.md) - Backend-specific documentation
- [frontend/README.md](./frontend/README.md) - Frontend-specific documentation

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🙏 Acknowledgments

- LangChain & LangGraph for LLM orchestration
- FastAPI for the excellent web framework
- Next.js for the frontend framework
- All open-source contributors

---

**Built with ❤️ by the DosiBridge team**
