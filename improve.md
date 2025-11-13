# Improvement Plan for agent-tool

This document outlines concrete, high‑impact improvements and advanced features for the project. It’s informed by the current codebase (FastAPI + LangChain + MCP + Next.js) and is organized by priority with scoped action items, acceptance criteria, and risks.

## Snapshot of the current system

- Backend
  - FastAPI app exists in two places:
    - Package app with routers: `backend/src/api/__init__.py` (uses `backend/src/api/routes/*`, includes auth, sessions, MCP server CRUD, chat streaming).
    - Monolithic app: `backend/src/api.py` (duplicates endpoints and diverges in config behavior).
  - LangChain agent with tools; streaming via SSE; RAG with FAISS using OpenAI embeddings.
  - MCP client manager with local server mounting at `/api/mcp/{server_name}` and per‑user MCP config stored in DB (routers version).
  - Auth: JWT, bcrypt hashing; models for `User`, `LLMConfig`, `MCPServer`.
  - DB: SQLAlchemy + Postgres; some schema adjustment logic in `init_db()`; Alembic listed but not wired.
  - Docker: backend image healthcheck hits `/health`; `CMD` runs `uvicorn src.api:app`.
- Frontend
  - Next.js 16 app with Zustand store, SSE streaming chat, settings for MCP servers, auth modal.
  - Runtime backend URL via `/api/runtime-config` route or `NEXT_PUBLIC_API_BASE_URL`.

## Immediate issues to fix

1. Duplicate API implementations cause ambiguity and drift

- Files: `backend/src/api/__init__.py` (routers) vs `backend/src/api.py` (monolith)
- Risk: `uvicorn src.api:app` may resolve to the module file (`src/api.py`) instead of the package (`src/api/__init__.py`), leading to different behavior between environments. The router app exposes `/api/auth/*` that the frontend expects; the monolith differs in LLM config and routes.

2. Conflicting LLM configuration paths

- `backend/src/api/routes/llm_config.py` disables changes (fixed OpenAI gpt-4o).
- `backend/src/config.py` currently hardcodes a fixed OpenAI config in `load_llm_config()` while DB logic is effectively bypassed.
- Historic code in `backend/src/api.py` allows switching to multiple providers and defaults to Gemini. These contradictions will lead to confusion and runtime surprises.

3. Volatile chat history

- Conversation history is in‑memory (`backend/src/history.py`), not persisted. Frontend stores a copy in browser storage, but backend state is lost on restart and can’t scale horizontally.

4. DB and migrations

- `DATABASE_URL` is required at import time; missing it raises immediately, making local DX brittle.
- Alembic dependency exists, but no Alembic project/versions; ad‑hoc `ALTER TABLE` logic lives in `init_db()`.

5. Security and robustness gaps

- Default JWT secret fallback string; unsafe in prod.
- CORS behavior inconsistent (router app has dev defaults; monolith requires env); may surprise deploys.
- No rate limiting on chat endpoints; no encryption at rest for MCP server API keys.

6. Observability and quality

- Minimal structured logging, no tracing/metrics, and no tests/CI.

---

## Advanced features to add

Agentic intelligence

- LangGraph planner–executor patterns: introduce planning, retries, and tool selection strategies. Persist tool runs and rationales for audit.
- Structured outputs for extraction tasks: JSON schema responses and validation; route structured results to the UI (download as JSON/CSV).

RAG 2.0

- Ingestion pipeline: file uploads (PDF, DOCX, TXT) and URL crawling; background job to chunk (token‑aware) and embed with metadata.
- Persistent vector store: use FAISS persistence directory or pgvector/Chroma; track collections in DB and provide per‑user namespaces.
- Hybrid retrieval and re‑ranking: combine keyword + dense retrieval; optional LLM re‑rank; show citations with source metadata.

Personalization and memory

- Persisted conversations with summaries: store messages in DB; auto‑summarize every N turns; display titles in sidebar.
- Memory layers: long‑term user profile facts and short‑term task memory; toggle in settings.

MCP ecosystem

- Health checks per MCP server: probe `list_tools`, latency, and auth; surface in Settings.
- “Marketplace” view: curated list of known MCP endpoints with tags and one‑click add.
- API key management: encrypted at rest; optional validation on save (test call).

Realtime and collaboration

- WebSocket transport (optional alongside SSE) for richer real‑time events: tool‑step updates, status, progress bars.
- Shared sessions (later): invite links, RBAC for multi‑user collaboration.

Governance & safety

- Prompt safety filters, PII redaction, and per‑role tool allow‑lists.
- Rate limiting per user/IP; abuse/threat detection hooks.

---

## Targeted refactors and fixes

1. Single source of truth for the API app (high priority)

- Action:
  - Remove `backend/src/api.py` (archive if needed) to eliminate ambiguity.
  - Ensure Docker `CMD` keeps pointing to `src.api:app` (the package’s `__init__.py`).
  - Verify the router app covers all endpoints the frontend calls.
- Acceptance criteria:
  - `uvicorn src.api:app` loads router version.
  - `/api/auth/*`, `/api/chat`, `/api/chat/stream`, `/api/sessions`, `/api/tools`, MCP endpoints all function.

2. Unify LLM configuration behavior

- Action:
  - Make `Config.load_llm_config()` consult DB when available; use env fallback for bootstrap.
  - Keep a single “reset to default” path (OpenAI gpt‑4o or Gemini—pick one, document it). Remove contradictory logic.
  - Update `routes/llm_config.py` and frontend expectations accordingly (it currently treats LLM config as disabled).
- Acceptance criteria:
  - One consistent source of truth; switching models either supported or explicitly disabled everywhere.
  - Clear logs and error messages for missing API keys.

3. Persist conversation history in DB

- Action:
  - Add tables: `conversations(id, user_id, title, created_at, updated_at)` and `messages(id, conversation_id, role, content, tool_calls JSON, created_at)`.
  - Update chat endpoints to read/write per user+session.
  - Auto‑generate session titles from first user message; add summaries every N messages.
- Acceptance criteria:
  - Restarting server doesn’t lose history; sessions in sidebar reflect DB counts.

4. Proper migrations with Alembic

- Action:
  - Initialize Alembic; generate migrations for users, llm_config, mcp_servers, conversations, messages.
  - Remove ad‑hoc `ALTER TABLE` logic from `init_db()` and have startup run `alembic upgrade head` (or document manual step).
- Acceptance criteria:
  - Clean migrations for a fresh DB and for upgrading existing installs.

5. Security hardening

- Action:
  - Enforce `JWT_SECRET_KEY` in prod; fail fast if default in production.
  - Centralize CORS config: strict allowlist in prod, sane defaults for dev.
  - Introduce request rate limiting (e.g., `slowapi`) on chat endpoints.
  - Encrypt MCP server `api_key` at rest (e.g., Fernet using an env KEK) or use a secrets manager.
- Acceptance criteria:
  - Security checks pass; secrets aren’t stored plaintext; rate limiting visible under load.

6. Observability & testing

- Action:
  - Structured JSON logging with request IDs and latency per request/tool call.
  - Metrics endpoint (`/metrics`) via Prometheus client for requests, errors, token counts, tool usage.
  - Add tests:
    - Unit: auth, config loading, LLM factory error handling.
    - Integration: chat RAG (with mock LLM), minimal MCP tool call (mock server).
  - CI: GitHub Actions running lint/type/test and frontend build.
- Acceptance criteria:
  - CI green; basic test coverage; logs and metrics usable in dev.

7. Developer experience & infra

- Action:
  - Add a Postgres service to `docker-compose.yml` with a named volume; set `DATABASE_URL` for dev automatically.
  - Provide `.env.example` with all required variables and comments.
  - Pre‑commit hooks (ruff/flake8, black, isort, mypy) and frontend type checks.
- Acceptance criteria:
  - One‑command local bring‑up; consistent formatting and linting.

---

## Prioritized roadmap

Quick wins (0.5–2 days)

- Remove `backend/src/api.py`; standardize on router app. Verify endpoints.
- Align `Config.load_llm_config()` with a single behavior; update logs and errors.
- Add rate limiting to `/api/chat` and `/api/chat/stream`.
- Tighten CORS defaults; enforce non‑default `JWT_SECRET_KEY` in prod.
- Improve error messages surfaced to the frontend (quota, auth, connection).

Near‑term (3–10 days)

- Persist history in DB; add sessions/messages models and use them in chat routes.
- Wire Alembic migrations; remove ad‑hoc schema changes from `init_db()`.
- Add Postgres service in Compose for turnkey dev; volume for persistence.
- MCP health checks in Settings; encrypt stored MCP API keys.
- Add tests (unit + minimal integration) and CI pipeline.

Later (2–6 weeks)

- RAG ingestion pipeline (uploads + URLs) with background jobs and persistent vector store (FAISS directory or pgvector/Chroma).
- LangGraph planner–executor with streaming tool steps; structured output mode.
- WebSockets transport (alongside SSE) for richer live updates.
- Observability: Prometheus metrics and/or LangSmith tracing dashboards.
- RBAC and org/workspaces if multi‑tenant is desired.

---

## Concrete implementation notes

- Docker & run

  - Backend `Dockerfile` uses `CMD ["python", "-m", "uvicorn", "src.api:app", "--host", "0.0.0.0", "--port", "8000"]`. After removing `backend/src/api.py`, `src.api` will resolve to `backend/src/api/__init__.py` reliably.
  - Healthcheck targets `/health` which the router app exposes.

- LLM factory consistency

  - Keep provider‑specific helpful errors (already good). Make sure `Config.load_llm_config()` feeds the factory consistently (OpenAI/Gemini/Groq/Ollama), and the frontend Settings reflect reality (if switching is disabled, disable the UI; if enabled, ensure endpoints accept it).

- RAG

  - Persist FAISS index to disk (`/app/data/index/faiss`) and version it in DB; build a simple ingestion endpoint for uploads and URLs.

- MCP

  - On save/update, optionally probe the MCP server (3–5s timeout) to validate URL and API key; store `status` and `last_checked_at` in DB; show in Settings.

- Security

  - Use Fernet encryption for `MCPServer.api_key` with a KEK from `MCP_APIKEY_KMS_KEY` or `MCP_APIKEY_SECRET` env.
  - Add `slowapi` or middleware-based limiter keyed by user id/IP + path.

- Observability
  - Add a request/response middleware to stamp `X-Request-ID`, log method/path/status/duration.
  - Prometheus metrics for request latency histogram, errors counter, streaming sessions gauge, tool call count by tool name.

---

## Acceptance criteria checklist

- Single API app (routers) loads in all environments; conflicting file removed.
- LLM config behavior is consistent and documented; frontend Settings align with backend capabilities.
- Conversation history persists across restarts; sessions and counts are accurate per user.
- Migrations reproducible; no schema drift code in `init_db()`.
- Rate limiting active on chat endpoints; CORS consistent; JWT secret enforced in prod.
- Basic tests and CI in place; logs/metrics available for debugging.

---

## Appendix

Key files

- Backend app (routers): `backend/src/api/__init__.py`
- Duplicate app (to remove): `backend/src/api.py`
- Routers: `backend/src/api/routes/*`
- Config: `backend/src/config.py`
- LLM factory: `backend/src/llm_factory.py`
- RAG: `backend/src/rag.py`
- MCP client: `backend/src/mcp_client.py`
- Models: `backend/src/models.py`
- DB: `backend/src/database.py`, `backend/init_db.py`
- Frontend app: `frontend/app/*`, store: `frontend/lib/store.ts`, API client: `frontend/lib/api.ts`

Env vars (dev minimum)

- `DATABASE_URL`
- `CORS_ORIGINS`
- `OPENAI_API_KEY` (embeddings; and/or LLM if using OpenAI)
- `GOOGLE_API_KEY` (if using Gemini)
- `GROQ_API_KEY` (if using Groq)
- `JWT_SECRET_KEY`

Optional docker-compose Postgres service (example)

```yaml
services:
  db:
    image: postgres:15
    container_name: agent-postgres
    environment:
      POSTGRES_USER: sazib
      POSTGRES_PASSWORD: 1234
      POSTGRES_DB: mcpagent
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    networks:
      - agent-dosi-network

volumes:
  pgdata:
```

---

## What I can implement first

- Remove duplicate API file, unify LLM config flow, and add rate limiting + improved CORS handling as a small PR.
- Alternatively, wire Alembic and add Postgres compose service to make local dev one‑command.

Ping me which path you prefer, and I’ll ship it next.
