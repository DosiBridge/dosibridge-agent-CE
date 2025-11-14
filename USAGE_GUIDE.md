# DosiBridge Agent - Usage Guide

## Overview

This project supports two main modes:
1. **Agent Mode** - Uses MCP tools and local tools for dynamic actions
2. **RAG Mode** - Uses uploaded documents with advanced retrieval for question answering

---

## 🚀 Getting Started

### Prerequisites
1. **Backend Setup:**
   ```bash
   cd backend
   pip install -r requirements.txt
   # Set up environment variables (DATABASE_URL, OPENAI_API_KEY, etc.)
   ./start_server.sh
   ```

2. **Frontend Setup:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```

3. **Database Setup:**
   - Ensure PostgreSQL is running
   - Set `DATABASE_URL` in `.env` file
   - Database tables will be created automatically on first run

---

## 🤖 Agent Mode

### What is Agent Mode?
Agent mode uses an AI agent that can:
- Call MCP (Model Context Protocol) tools
- Use local tools (like DosiBlog context retrieval)
- Perform dynamic actions based on user queries
- Reason and act using available tools

### How to Use Agent Mode:

1. **Login/Register:**
   - Click "Log in" or "Create account" in the UI
   - You must be authenticated to use Agent mode

2. **Switch to Agent Mode:**
   - Click the **"Agent"** button in the chat input area
   - The button will turn green when active

3. **Configure MCP Servers (Optional):**
   - Click the **Settings** icon (⚙️) in the header
   - Go to **"MCP Servers"** tab
   - Add MCP servers:
     - **Name**: Server identifier
     - **URL**: Server endpoint (e.g., `http://localhost:8000/api/mcp/server/mcp`)
     - **Connection Type**: HTTP, SSE, or STDIO
     - **API Key**: Optional authentication
     - **Headers**: Custom headers if needed
   - Click **"Test Connection"** before adding
   - Toggle servers on/off as needed

4. **Start Chatting:**
   - Type your question in the chat input
   - The agent will:
     - Analyze your query
     - Decide which tools to use
     - Call appropriate tools
     - Provide a comprehensive answer

### Example Queries for Agent Mode:
```
"What's the weather in New York?"
"Calculate 25 * 37 + 100"
"Tell me about DosiBlog project"
"Search for information about Python async programming"
```

---

## 📚 RAG Mode (Retrieval-Augmented Generation)

### What is RAG Mode?
RAG mode allows you to:
- Upload documents (PDF, TXT, DOCX, MD)
- Ask questions about your uploaded documents
- Use advanced retrieval with hybrid search (vector + BM25)
- Enable ReAct reasoning for complex queries
- Organize documents into collections

### How to Use RAG Mode:

#### Step 1: Switch to RAG Mode
- Click the **"RAG"** button in the chat input area
- The button will turn green when active

#### Step 2: Upload Documents
1. Click the **Settings icon (⚙️)** next to the RAG button
2. Go to **"Documents"** tab
3. **Upload files:**
   - Drag and drop files into the upload area, OR
   - Click "Select Files" to browse
   - Supported formats: PDF, TXT, DOCX, MD (Max 100MB per file)
4. Files will be processed in the background:
   - Text extraction
   - Chunking
   - Embedding generation

#### Step 3: Review Documents (Human-in-the-Loop)
1. Go to **"Review"** tab in RAG Settings
2. Check documents that need review:
   - **Pending**: Still processing
   - **Needs Review**: Requires human approval
   - **Ready**: Available for RAG queries
   - **Error**: Processing failed
3. **Approve or Reject:**
   - Click **"Approve"** to make document available for RAG
   - Click **"Reject"** to mark as error (with optional reason)

#### Step 4: Organize Documents (Optional)
1. Go to **"Collections"** tab
2. **Create a collection:**
   - Enter collection name
   - Add description (optional)
   - Click "Create Collection"
3. **Select a collection:**
   - Click "Select" on a collection to filter documents
   - Only documents in selected collection will be used for RAG

#### Step 5: Configure RAG Settings
1. In RAG Settings panel, you'll see:
   - **ReAct Mode Toggle**: Enable/disable reasoning and acting
   - **Collection Filter**: Select which collection to use
2. **ReAct Mode:**
   - **ON**: Agent reasons step-by-step before answering
   - **OFF**: Direct retrieval and answer

#### Step 6: Ask Questions
- Type questions about your uploaded documents
- Examples:
  ```
  "What is the main topic of the document?"
  "Summarize the key points"
  "What does the document say about [topic]?"
  "Find information about [specific subject]"
  ```

---

## 🔄 Switching Between Modes

### During a Conversation:
- You can switch between Agent and RAG modes at any time
- Each mode maintains its own conversation context
- Mode switch doesn't affect previous messages

### Mode-Specific Features:

**Agent Mode:**
- ✅ MCP tool integration
- ✅ Dynamic tool calling
- ✅ Real-time actions
- ❌ Document-based retrieval

**RAG Mode:**
- ✅ Document upload and management
- ✅ Advanced retrieval (hybrid search)
- ✅ Re-ranking for better results
- ✅ ReAct reasoning (optional)
- ✅ Collection organization
- ❌ MCP tool integration (uses document retrieval instead)

---

## 🎯 Advanced Features

### ReAct Mode (RAG Only)
When enabled in RAG mode:
- Agent thinks step-by-step
- Uses reasoning before answering
- Better for complex questions
- More transparent thought process

**Enable:**
1. Switch to RAG mode
2. Open RAG Settings
3. Toggle **"ReAct Mode"** ON

### Collections
Organize documents into collections:
- **Use Case**: Separate documents by topic, project, or category
- **Example**: 
  - Collection: "Project Documentation"
  - Collection: "Research Papers"
  - Collection: "Meeting Notes"

**Benefits:**
- Filter queries to specific document sets
- Better organization
- Faster retrieval (smaller search space)

---

## 📊 Document Status Guide

| Status | Meaning | Action Required |
|--------|---------|----------------|
| **Pending** | Uploaded, waiting to process | Wait for processing |
| **Processing** | Currently extracting text/chunking | Wait for completion |
| **Needs Review** | Processing complete, needs approval | Review and Approve/Reject |
| **Ready** | Available for RAG queries | None - ready to use |
| **Error** | Processing failed | Check error, re-upload if needed |

---

## 🔧 Troubleshooting

### Agent Mode Issues:
- **No tools available**: Check MCP server configuration in Settings
- **Tool calls failing**: Verify MCP server is running and accessible
- **Connection errors**: Check server URLs and API keys

### RAG Mode Issues:
- **No documents found**: Upload documents first, ensure they're approved
- **Poor answers**: 
  - Try enabling ReAct mode
  - Check if documents are relevant
  - Ensure documents are in "Ready" status
- **Upload fails**: 
  - Check file size (max 100MB)
  - Verify file format (PDF, TXT, DOCX, MD)
  - Check server logs for errors

### General Issues:
- **Authentication required**: Login/Register first
- **Database errors**: Check DATABASE_URL in .env
- **API errors**: Verify OPENAI_API_KEY is set for embeddings

---

## 💡 Best Practices

### For Agent Mode:
1. Configure MCP servers before use
2. Test connections before adding servers
3. Use specific queries for better tool selection
4. Check available tools in Settings > Tools tab

### For RAG Mode:
1. **Upload quality documents**: Clear, well-formatted files work best
2. **Review before use**: Approve documents to ensure quality
3. **Use collections**: Organize related documents together
4. **Enable ReAct for complex queries**: Better reasoning for difficult questions
5. **Be specific**: More specific questions get better answers

### Document Upload Tips:
- **PDF**: Works best with text-based PDFs (not scanned images)
- **TXT**: Plain text files, UTF-8 encoding preferred
- **DOCX**: Microsoft Word documents
- **MD**: Markdown files

---

## 🎓 Example Workflows

### Workflow 1: Research Assistant (RAG Mode)
1. Upload research papers (PDF)
2. Create collection: "Research Papers"
3. Enable ReAct mode
4. Ask: "What are the main findings across all papers?"
5. Ask follow-up questions about specific topics

### Workflow 2: Project Documentation (RAG Mode)
1. Upload project docs (DOCX, PDF)
2. Create collection: "Project Docs"
3. Select collection
4. Ask: "How do I set up the development environment?"
5. Get answers from your documentation

### Workflow 3: Multi-Tool Agent (Agent Mode)
1. Configure weather MCP server
2. Configure calculator tool
3. Ask: "What's the weather in Paris and convert 75°F to Celsius"
4. Agent uses multiple tools to answer

---

## 🔐 Authentication

- **Required for**: All features (Agent mode, RAG mode, settings)
- **Registration**: Create account with email, name, password
- **Login**: Use registered credentials
- **Session**: Stays logged in until logout

---

## 📝 API Endpoints

### Chat:
- `POST /api/chat` - Non-streaming chat
- `POST /api/chat/stream` - Streaming chat

### Documents:
- `POST /api/documents/upload` - Upload document
- `GET /api/documents` - List documents
- `GET /api/documents/{id}` - Get document details
- `DELETE /api/documents/{id}` - Delete document
- `POST /api/documents/{id}/approve` - Approve document
- `POST /api/documents/{id}/reject` - Reject document

### Collections:
- `POST /api/collections` - Create collection
- `GET /api/collections` - List collections
- `DELETE /api/collections/{id}` - Delete collection

### Settings:
- `GET /api/mcp-servers` - List MCP servers
- `POST /api/mcp-servers` - Add MCP server
- `GET /api/llm-config` - Get LLM configuration

---

## 🚀 Quick Start Checklist

- [ ] Backend server running (`./start_server.sh`)
- [ ] Frontend running (`npm run dev`)
- [ ] Database configured (DATABASE_URL set)
- [ ] OpenAI API key set (for embeddings)
- [ ] User account created
- [ ] Logged in
- [ ] (Optional) MCP servers configured (for Agent mode)
- [ ] (Optional) Documents uploaded (for RAG mode)

---

## 📞 Support

For issues or questions:
1. Check server logs for errors
2. Verify environment variables
3. Check database connection
4. Review this guide for common issues

---

**Happy Chatting! 🎉**

