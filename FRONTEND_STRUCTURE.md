# Frontend Project Structure

This document describes the reorganized frontend structure for better maintainability and professional organization.

## Overview

The frontend has been reorganized to separate:

- **Types/Interfaces** - All TypeScript type definitions
- **API Clients** - Organized by domain (auth, chat, documents, etc.)
- **Components** - React components
- **Utilities** - Helper functions and utilities

## Directory Structure

```
frontend/
├── types/
│   └── api/                    # API-related types
│       ├── auth.ts             # Authentication types
│       ├── chat.ts             # Chat types
│       ├── documents.ts        # Document types
│       ├── health.ts           # Health check types
│       ├── llm.ts              # LLM config types
│       ├── mcp.ts              # MCP server types
│       ├── sessions.ts         # Session types
│       ├── tools.ts            # Tools types
│       └── index.ts            # Centralized type exports
│
├── lib/
│   └── api/                    # API client modules
│       ├── client.ts           # Base client utilities
│       │                       # - getApiBaseUrl()
│       │                       # - getAuthToken()
│       │                       # - handleResponse()
│       │                       # - getAuthHeaders()
│       │
│       ├── auth.ts             # Authentication API
│       │                       # - register()
│       │                       # - login()
│       │                       # - logout()
│       │                       # - getCurrentUser()
│       │
│       ├── chat.ts             # Chat API
│       │                       # - sendChatMessage()
│       │                       # - createStreamReader()
│       │
│       ├── documents.ts        # Documents API
│       │                       # - uploadDocument()
│       │                       # - listDocuments()
│       │                       # - deleteDocument()
│       │                       # - createCollection()
│       │                       # - etc.
│       │
│       ├── health.ts           # Health check API
│       │                       # - getHealth()
│       │
│       ├── llm.ts              # LLM config API
│       │                       # - getLLMConfig()
│       │                       # - setLLMConfig()
│       │                       # - resetLLMConfig()
│       │
│       ├── mcp.ts              # MCP servers API
│       │                       # - listMCPServers()
│       │                       # - addMCPServer()
│       │                       # - updateMCPServer()
│       │                       # - etc.
│       │
│       ├── sessions.ts         # Sessions API
│       │                       # - listSessions()
│       │                       # - getSession()
│       │                       # - deleteSession()
│       │
│       ├── tools.ts            # Tools API
│       │                       # - getToolsInfo()
│       │                       # - Custom RAG tools CRUD
│       │
│       └── index.ts            # Centralized API exports
│
├── components/                 # React components
├── hooks/                      # Custom React hooks
├── app/                        # Next.js app directory
└── lib/
    ├── api.ts                  # Backward compatibility (re-exports)
    └── ...                     # Other utilities
```

## Usage Examples

### Importing Types

```typescript
// Import specific types
import type { User, LoginRequest } from "@/types/api/auth";
import type { ChatRequest, StreamChunk } from "@/types/api/chat";
import type { Document } from "@/types/api/documents";

// Or import from centralized index
import type { User, ChatRequest, Document } from "@/types/api";
```

### Importing API Clients

```typescript
// Import specific API functions
import { login, logout, getCurrentUser } from "@/lib/api/auth";
import { createStreamReader } from "@/lib/api/chat";
import { uploadDocument, listDocuments } from "@/lib/api/documents";

// Or import from centralized index (for convenience)
import { login, createStreamReader, uploadDocument } from "@/lib/api";
```

### Using Base Client Utilities

```typescript
import { getApiBaseUrl, getAuthToken, handleResponse } from "@/lib/api/client";
```

## Benefits

1. **Separation of Concerns**: Types and API calls are clearly separated
2. **Better Organization**: Related functionality is grouped together
3. **Easier Maintenance**: Changes to one domain don't affect others
4. **Better Tree-shaking**: Import only what you need
5. **Type Safety**: Centralized type definitions ensure consistency
6. **Backward Compatibility**: Old imports still work via re-exports

## Migration Guide

### Old Way (Still Works)

```typescript
import { login, User, ChatRequest } from "@/lib/api";
```

### New Way (Recommended)

```typescript
import { login } from "@/lib/api/auth";
import type { User } from "@/types/api/auth";
import type { ChatRequest } from "@/types/api/chat";
```

## Notes

- The old `lib/api.ts` file is kept for backward compatibility
- All existing imports will continue to work
- Gradually migrate to the new structure for better code organization
- Types are in `types/api/` and API clients are in `lib/api/`
