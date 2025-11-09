# Environment Variables Guide

## Required Environment Variables

### `OPENAI_API_KEY` (Required)
**Purpose**: Used for FAISS embeddings in the RAG system  
**Required**: Yes (for RAG to work)  
**Get it from**: https://platform.openai.com/api-keys  
**Example**: `OPENAI_API_KEY=sk-proj-...`

**Note**: This is required even if you're using Gemini or other LLMs for responses. FAISS embeddings always use OpenAI.

## Optional Environment Variables

### LLM Provider Keys (Choose based on your LLM config)

#### `GOOGLE_API_KEY` (Optional)
**Purpose**: For Google Gemini models  
**Required**: Only if using Gemini as main LLM  
**Get it from**: https://aistudio.google.com/app/apikey  
**Example**: `GOOGLE_API_KEY=AIzaSy...`

#### `GROQ_API_KEY` (Optional)
**Purpose**: For Groq models  
**Required**: Only if using Groq as main LLM  
**Get it from**: https://console.groq.com/keys  
**Example**: `GROQ_API_KEY=gsk_...`

### Server Configuration

#### `PORT` (Optional)
**Purpose**: Backend server port  
**Default**: `8000`  
**Example**: `PORT=8000`

### CORS Configuration

#### `CORS_ORIGINS` (Optional)
**Purpose**: Allowed origins for CORS  
**Format**: Comma-separated list  
**Default**: `http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000,http://127.0.0.1:3001,https://rag-mcp-htiw.onrender.com`  
**Example**: `CORS_ORIGINS=http://localhost:3000,https://app.example.com`

### MCP Servers

#### `MCP_SERVERS` (Optional)
**Purpose**: Configure MCP servers via environment variable  
**Format**: JSON array  
**Alternative**: Use `config/mcp_servers.json` file  
**Example**: 
```bash
MCP_SERVERS='[{"name":"MyServer","url":"https://example.com/mcp","enabled":true}]'
```

### Model Configuration

#### `OPENAI_MODEL` (Optional)
**Purpose**: Default OpenAI model name  
**Default**: `gpt-4o`  
**Example**: `OPENAI_MODEL=gpt-4o-mini`

### Optional API Keys

#### `FIRECRAWL_API_KEY` (Optional)
**Purpose**: For web scraping tools  
**Get it from**: https://firecrawl.dev  
**Example**: `FIRECRAWL_API_KEY=fc-...`

## Setup Instructions

1. **Copy the example file**:
   ```bash
   cp .env.example .env
   ```

2. **Edit `.env`** and add your API keys:
   ```bash
   nano .env  # or use your preferred editor
   ```

3. **Minimum required**:
   - `OPENAI_API_KEY` (for FAISS embeddings)

4. **Based on your LLM choice** (in `config/llm_config.json`):
   - If using **Gemini**: Add `GOOGLE_API_KEY`
   - If using **OpenAI**: `OPENAI_API_KEY` is already set
   - If using **Groq**: Add `GROQ_API_KEY`
   - If using **Ollama**: No API key needed (local)

## Configuration Priority

1. **LLM Config**: `config/llm_config.json` (recommended)
2. **Environment Variables**: `.env` file
3. **System Environment**: Direct `export` commands

## Example `.env` File

```bash
# Required for FAISS embeddings
OPENAI_API_KEY=sk-proj-your-key-here

# For Gemini (if using as main LLM)
GOOGLE_API_KEY=AIzaSy-your-key-here

# CORS configuration
CORS_ORIGINS=http://localhost:3000,http://localhost:8086

# Server port
PORT=8000
```

## Verification

After setting up `.env`, verify it's loaded:
```bash
# Check if variables are loaded
python -c "from src.config import Config; print('OpenAI Key:', 'Set' if Config.OPENAI_API_KEY else 'Not Set')"
```

