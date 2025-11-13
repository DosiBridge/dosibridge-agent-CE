# প্রজেক্ট উন্নতির প্রায়োরিটি লিস্ট

## 🔴 High Priority (জরুরী)

### 1. **Conversation History Database Persistence** ⭐⭐⭐

**বর্তমান সমস্যা:** History এখনো in-memory-তে, server restart হলে সব হারিয়ে যায়

**কি করতে হবে:**

- Database-এ `conversations` এবং `messages` table তৈরি
- History manager-কে DB-based করতে হবে
- Auto-generate conversation titles
- Session sidebar-এ DB থেকে load হবে

**Impact:** High - User experience এর জন্য critical

---

### 2. **MCP API Key Encryption** 🔒

**বর্তমান সমস্যা:** API keys plain text-এ database-এ store হচ্ছে

**কি করতে হবে:**

- Fernet encryption ব্যবহার করে API keys encrypt করা
- Environment variable থেকে encryption key নেওয়া
- Encrypt/decrypt helper functions

**Impact:** High - Security critical

---

### 3. **Proper Database Migrations (Alembic)** 📊

**বর্তমান সমস্যা:** Ad-hoc `ALTER TABLE` logic `init_db()`-এ

**কি করতে হবে:**

- Alembic initialize করা
- Migration files তৈরি করা
- `init_db()` থেকে ALTER TABLE logic সরানো

**Impact:** Medium-High - Database management এর জন্য important

---

### 4. **Environment Variables Validation** ✅

**বর্তমান সমস্যা:** Missing env vars-এর জন্য runtime errors

**কি করতে হবে:**

- `.env.example` file তৈরি
- Startup-এ required env vars check করা
- Clear error messages

**Impact:** Medium - Developer experience

---

## 🟡 Medium Priority (গুরুত্বপূর্ণ)

### 5. **Structured Logging & Metrics** 📈

**বর্তমান সমস্যা:** Minimal logging, no metrics

**কি করতে হবে:**

- JSON structured logging
- Request ID tracking
- Prometheus metrics endpoint (`/metrics`)
- Log levels (DEBUG, INFO, WARNING, ERROR)

**Impact:** Medium - Observability এবং debugging

---

### 6. **RAG File Upload Support** 📄

**বর্তমান সমস্যা:** RAG-এ documents manually add করতে হয়

**কি করতে হবে:**

- File upload endpoint (PDF, DOCX, TXT)
- Background job for chunking এবং embedding
- Progress tracking
- Per-user document collections

**Impact:** Medium - Feature enhancement

---

### 7. **Persistent Vector Store** 💾

**বর্তমান সমস্যা:** FAISS index in-memory, restart হলে হারিয়ে যায়

**কি করতে হবে:**

- FAISS index disk-এ save করা
- Database-এ collection metadata store
- Version management

**Impact:** Medium - Data persistence

---

### 8. **Unit & Integration Tests** 🧪

**বর্তমান সমস্যা:** No test coverage

**কি করতে হবে:**

- Unit tests (auth, config, LLM factory)
- Integration tests (chat, MCP connections)
- Test fixtures এবং mocks
- CI pipeline (GitHub Actions)

**Impact:** Medium - Code quality এবং reliability

---

### 9. **Better Error Handling & User Feedback** 💬

**বর্তমান সমস্যা:** Generic error messages

**কি করতে হবে:**

- Specific error types
- User-friendly error messages
- Frontend error handling improvements
- Error logging এবং tracking

**Impact:** Medium - User experience

---

### 10. **API Documentation** 📚

**বর্তমান সমস্যা:** Swagger/OpenAPI might not be fully configured

**কি করতে হবে:**

- Complete OpenAPI schema
- Endpoint documentation
- Request/response examples
- Authentication documentation

**Impact:** Low-Medium - Developer experience

---

## 🟢 Low Priority (Nice to Have)

### 11. **MCP Server Health Monitoring** 🏥

**কি করতে হবে:**

- Periodic health checks
- Status dashboard
- Auto-disable unhealthy servers
- Latency tracking

---

### 12. **Conversation Summarization** 📝

**কি করতে হবে:**

- Auto-summarize long conversations
- Conversation titles generation
- Search functionality

---

### 13. **Rate Limiting Per User** ⏱️

**কি করতে হবে:**

- User-based rate limits
- Different limits for different endpoints
- Rate limit headers in response

---

### 14. **WebSocket Support** 🔌

**কি করতে হবে:**

- WebSocket transport alongside SSE
- Real-time tool execution updates
- Better progress tracking

---

### 15. **Multi-language Support** 🌍

**কি করতে হবে:**

- i18n for frontend
- Language detection
- Multi-language responses

---

## 📋 Implementation Order (Recommended)

### Phase 1 (1-2 weeks):

1. ✅ Conversation History DB Persistence
2. ✅ MCP API Key Encryption
3. ✅ Environment Variables Validation
4. ✅ .env.example file

### Phase 2 (2-3 weeks):

5. ✅ Alembic Migrations
6. ✅ Structured Logging
7. ✅ Basic Tests
8. ✅ Better Error Handling

### Phase 3 (3-4 weeks):

9. ✅ RAG File Upload
10. ✅ Persistent Vector Store
11. ✅ Metrics Endpoint
12. ✅ API Documentation

### Phase 4 (Future):

13. Health Monitoring
14. Conversation Summarization
15. WebSocket Support
16. Advanced Features

---

## 🎯 Quick Wins (Can do immediately)

1. **Create `.env.example`** - 15 minutes
2. **Add environment validation** - 30 minutes
3. **Improve error messages** - 1 hour
4. **Add request ID logging** - 1 hour
5. **Create basic test structure** - 2 hours

---

## 📊 Current Status

### ✅ Already Done:

- ✅ Architecture improvements (core, services, utils)
- ✅ Rate limiting
- ✅ CORS configuration
- ✅ JWT secret enforcement
- ✅ MCP connection testing
- ✅ Connection types (stdio, http, sse)
- ✅ Database setup with Postgres

### ❌ Still Missing:

- ❌ Conversation history persistence
- ❌ API key encryption
- ❌ Proper migrations
- ❌ Tests
- ❌ Structured logging
- ❌ File uploads
- ❌ Persistent vector store

---

## 💡 Next Steps

1. **Choose priority items** from above
2. **Start with Phase 1** (highest impact)
3. **Incremental improvements** - don't try to do everything at once
4. **Test as you go** - ensure each improvement works

---

**Note:** এই list-টি dynamic - priorities change হতে পারে project needs অনুযায়ী।
