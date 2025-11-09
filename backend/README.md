# AI MCP Agent with RAG & History Maintenance

A powerful AI agent system that combines Model Context Protocol (MCP) tools with Retrieval-Augmented Generation (RAG) and conversation history maintenance for intelligent, context-aware interactions.

## 🌟 Features

### Core Capabilities
- ✅ **RAG (Retrieval-Augmented Generation)** - Context-aware question answering using FAISS vector store
- ✅ **Conversation History** - Session-based chat memory for multi-turn conversations
- ✅ **History-Aware Retrieval** - Automatically reformulates questions using conversation context
- ✅ **MCP Tool Integration** - Connect to any MCP-compatible tool server
- ✅ **Multiple Operating Modes** - Agent mode (with tools) or RAG-only mode
- ✅ **Session Management** - Support for multiple concurrent conversations
- ✅ **CLI Interface** - Easy-to-use command-line interface

### Inspired by Production Systems
This implementation draws concepts from production-grade systems like DosiBridge/dosi-engine's RAG implementation:
- Session-based history management (similar to multi-tenant approach)
- History-aware retrieval using LangChain
- Modular architecture for easy extension

## 🚀 Quick Start

### Installation

```bash
# Clone or download the repository
cd mcp-server

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp .env.example .env
# Add your OPENAI_API_KEY to .env
```

### Basic Usage

```bash
# Run default demo with examples
python ai_mcp_dynamic.py

# Ask a simple question
python ai_mcp_dynamic.py --query "What is DosiBlog?"

# Start a conversation with history
python ai_mcp_dynamic.py --query "Hi, I'm Alice" --session-id alice
python ai_mcp_dynamic.py --query "What's my name?" --session-id alice

# Use RAG-only mode (faster, no MCP tools)
python ai_mcp_dynamic.py --mode rag --query "Tell me about DosiBlog"
```

## 🐳 Docker Support

### Quick Start with Docker

```bash
# Build the image
docker build -t mcp-server:latest .

# Run the container
docker run -d -p 8000:8000 \
  -e OPENAI_API_KEY=your-api-key \
  -v $(pwd)/config:/app/config:ro \
  mcp-server:latest
```

### Using Docker Compose

```bash
# Start the service
docker-compose up -d

# View logs
docker-compose logs -f

# Stop the service
docker-compose down
```

### Automated Docker Hub Publishing

This project includes GitHub Actions workflow that automatically builds and pushes Docker images to Docker Hub on:
- Push to `main`/`master` branch
- Version tags (e.g., `v1.0.0`)
- Manual trigger

**Setup Instructions:**
1. Add secrets to GitHub: `DOCKER_HUB_USERNAME` and `DOCKER_HUB_ACCESS_TOKEN`
2. See `.github/SETUP.md` for detailed setup guide

For more Docker documentation, see [DOCKER.md](DOCKER.md).

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [QUICK_START.md](QUICK_START.md) | Getting started guide |
| [MCP_USAGE.md](MCP_USAGE.md) | MCP server integration |
| [RAG_HISTORY_GUIDE.md](RAG_HISTORY_GUIDE.md) | Detailed RAG & history documentation |
| [QUICK_REFERENCE.md](QUICK_REFERENCE.md) | Quick reference card |

## 💡 Usage Examples

### Example 1: Multi-Turn Conversation

```bash
# Turn 1: Introduction
python ai_mcp_dynamic.py --session-id user1 \
  --query "I'm interested in web development with Node.js"

# Turn 2: Follow-up (remembers context)
python ai_mcp_dynamic.py --session-id user1 \
  --query "What projects use these technologies?"

# Turn 3: Another follow-up
python ai_mcp_dynamic.py --session-id user1 \
  --query "Can you tell me more about DosiBlog?"

# View conversation history
python ai_mcp_dynamic.py --show-history --session-id user1
```

### Example 2: Agent with Tools

```bash
# Agent can use both MCP tools and RAG
python ai_mcp_dynamic.py \
  --query "Calculate 25 * 4 and tell me about DosiBlog"

# Follow-up using history
python ai_mcp_dynamic.py \
  --query "What was that number again?"
```

### Example 3: RAG-Only Mode

```bash
# Faster queries without tool overhead
python ai_mcp_dynamic.py --mode rag \
  --query "What technologies does DosiBlog use?"

python ai_mcp_dynamic.py --mode rag \
  --query "When was it started?"
```

### Example 4: Session Management

```bash
# View all active sessions
python ai_mcp_dynamic.py --show-history

# View specific session
python ai_mcp_dynamic.py --show-history --session-id user1

# Clear a session
python ai_mcp_dynamic.py --clear-history --session-id user1
```

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────┐
│                   User Interface (CLI)                  │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│              ConversationHistoryManager                 │
│  • Session-based storage (Dict[session_id → history])  │
│  • Message persistence and retrieval                    │
│  • Multi-session support                                │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                 EnhancedRAGSystem                       │
│  • FAISS vector store for similarity search             │
│  • OpenAI embeddings for semantic understanding         │
│  • History-aware retriever (reformulates questions)     │
│  • Context retrieval from knowledge base                │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│            Agent Executor (Optional)                    │
│  • MCP tool integration                                 │
│  • Multi-tool orchestration                             │
│  • Tool selection and execution                         │
└────────────────────────────────────────────────────────┘
                          ↓
┌────────────────────────────────────────────────────────┐
│                  LLM (GPT-4o)                          │
│  • Natural language understanding                       │
│  • Response generation                                  │
│  • Context-aware answers                                │
└────────────────────────────────────────────────────────┘
```

## 🔄 How History-Aware Retrieval Works

The system automatically reformulates follow-up questions using conversation context:

```
User: "What is DosiBlog?"
AI: "DosiBlog is a web development project..."

User: "Who created it?"
       ↓ (System reformulates using history)
      "Who created DosiBlog?"
AI: "DosiBlog was created by Abdullah Al Sazib."

User: "What technologies does it use?"
       ↓ (System reformulates using history)
      "What technologies does DosiBlog use?"
AI: "DosiBlog uses Node.js, Express, and MongoDB."
```

## 📊 Command Line Options

```bash
python ai_mcp_dynamic.py [OPTIONS]

Query Options:
  --query, -q TEXT          Query to send to the agent
  --mode, -m {agent,rag}    Operating mode (default: agent)
  
Session Management:
  --session-id, --sid TEXT  Session ID for conversation history (default: default)
  --show-history            Show conversation history for session
  --clear-history           Clear conversation history for session
  
MCP Configuration:
  --add-server, -s JSON     Add MCP server as JSON: '{"name":"Name","url":"https://..."}'
  
Help:
  --help                    Show help message and examples
```

## 🎯 Use Cases

### 1. Customer Support Chatbot
```bash
# Each customer gets their own session
python ai_mcp_dynamic.py --sid customer_123 \
  --query "I have a problem with my order"
  
# Follow-up in same session maintains context
python ai_mcp_dynamic.py --sid customer_123 \
  --query "Can you help me with that?"
```

### 2. Educational Assistant
```bash
# Student learning session
python ai_mcp_dynamic.py --sid student_alice --mode rag \
  --query "Explain Node.js"
  
python ai_mcp_dynamic.py --sid student_alice --mode rag \
  --query "How is it different from Python?"
```

### 3. Technical Documentation Q&A
```bash
# Query your documentation
python ai_mcp_dynamic.py --mode rag \
  --query "How do I set up the development environment?"
```

## 🔧 Configuration

### Environment Variables

Create a `.env` file:

```env
# Required
OPENAI_API_KEY=your-api-key-here

# Optional MCP servers (JSON array)
MCP_SERVERS=[{"name":"MyServer","url":"https://example.com/mcp"}]
```

### MCP Servers Configuration

Create `mcp_servers.json`:

```json
[
  {
    "name": "Calculator",
    "url": "https://example.com/mcp/calculator"
  },
  {
    "name": "WeatherAPI",
    "url": "https://example.com/mcp/weather",
    "headers": {
      "Authorization": "Bearer YOUR_TOKEN"
    }
  }
]
```

## 🆚 Comparison: ai_mcp_dynamic vs dosi-engine

| Feature | ai_mcp_dynamic | dosi-engine |
|---------|----------------|-------------|
| **Vector Store** | FAISS (in-memory) | Weaviate (persistent) |
| **Embeddings** | OpenAI | HuggingFace |
| **LLM** | OpenAI GPT-4o | Gemini/DeepSeek/Ollama |
| **History** | In-memory sessions | In-memory multi-tenant |
| **Streaming** | ❌ Not yet | ✅ Async streaming |
| **Persistence** | ❌ In-memory only | ✅ Weaviate database |
| **Tools** | ✅ MCP integration | ❌ No external tools |
| **CLI** | ✅ Full CLI | ❌ No CLI |
| **Use Case** | Development/Testing | Production chatbots |

## 🔮 Future Enhancements

- [ ] Persistent storage (PostgreSQL, Redis, Weaviate)
- [ ] Streaming responses for better UX
- [ ] Session expiry and cleanup
- [ ] Context window management
- [ ] Multiple vector store backends
- [ ] Web API (FastAPI/Flask)
- [ ] Docker containerization
- [ ] Hybrid search (keyword + semantic)
- [ ] Document upload and indexing
- [ ] Advanced RAG techniques (reranking, query expansion)

## 🤝 Contributing

Contributions are welcome! Areas for improvement:

1. **Persistence Layer** - Add database backend for history
2. **Streaming** - Implement async streaming responses
3. **More Vector Stores** - Support Pinecone, ChromaDB, etc.
4. **Web Interface** - Build a web UI
5. **Documentation** - More examples and tutorials

## 📝 Requirements

```
langchain
langchain-core
langchain-community
langchain-openai
langchain-mcp-adapters
openai
faiss-cpu
python-dotenv
mcp
```

See `requirements.txt` for complete list.

## 🐛 Troubleshooting

### Common Issues

**Issue**: "RAG system not available"
```bash
# Solution: Install FAISS
pip install faiss-cpu
```

**Issue**: "No conversation history found"
```bash
# Solution: Check session ID or start new conversation
python ai_mcp_dynamic.py --show-history --sid your-session-id
```

**Issue**: "Context doesn't include recent messages"
```bash
# Solution: Verify using same session ID
python ai_mcp_dynamic.py --sid consistent-id --query "Your question"
```

**Issue**: "OpenAI API key not found"
```bash
# Solution: Set environment variable
export OPENAI_API_KEY="your-key-here"
# Or add to .env file
```

## 📄 License

This project is provided as-is for educational and development purposes.

## 🙏 Acknowledgments

- Inspired by DosiBridge/dosi-engine's RAG and history implementation
- Built with LangChain framework
- Uses OpenAI's GPT-4o and embeddings
- MCP protocol for tool integration

## 📞 Support

For detailed documentation:
- See [RAG_HISTORY_GUIDE.md](RAG_HISTORY_GUIDE.md) for technical details
- See [QUICK_REFERENCE.md](QUICK_REFERENCE.md) for command examples
- Check [MCP_USAGE.md](MCP_USAGE.md) for MCP integration

---

**Made with ❤️ for developers building context-aware AI agents**

