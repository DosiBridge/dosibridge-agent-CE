# AI MCP Agent Frontend

A modern Next.js frontend for the AI MCP Agent Backend, featuring ChatGPT-like interface with streaming chat, session management, MCP server configuration, and LLM settings.

## Features

- 💬 **Streaming Chat**: Real-time character-by-character streaming responses using Server-Sent Events (SSE)
- 🧭 **Session Management**: Create, switch, and delete conversation sessions with history persistence
- ⚙️ **Settings Panel**: Configure MCP servers and LLM settings through an intuitive UI
- 🔍 **Dual Modes**: Switch between Agent mode (with tools) and RAG mode
- 📊 **Health Monitoring**: Real-time backend health status and MCP server count
- 🎨 **Modern UI**: ChatGPT-inspired design with automatic dark mode support
- 📝 **Markdown Support**: Rich text rendering for AI responses with code blocks and formatting

## Getting Started

### Prerequisites

- Node.js 18+ and npm/yarn/pnpm
- Backend API running (see [mcp-server README](../mcp-server/README.md) for backend setup)
  - Local: `http://localhost:8000`
  - Production: Configure via `NEXT_PUBLIC_API_BASE_URL`

### Installation

```bash
# Clone the repository (if not already done)
cd ai-chatbot

# Install dependencies
npm install
# or
yarn install
# or
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
# Backend API Base URL
# For local development:
NEXT_PUBLIC_API_BASE_URL=http://localhost:8000

# For production, use your deployed backend URL:
# NEXT_PUBLIC_API_BASE_URL=https://your-backend-url.com
```

If not set, defaults to `http://localhost:8000`.

### Development

1. **Start the backend** (in a separate terminal):
   ```bash
   cd ../mcp-server
   docker compose up
   # or
   python -m uvicorn src.api:app --reload
   ```

2. **Start the frontend**:
   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

3. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
ai-chatbot/
├── app/
│   ├── layout.tsx          # Root layout with fonts
│   ├── page.tsx            # Main chat page
│   ├── globals.css         # Global styles and Tailwind
│   └── api/                # API routes (if needed)
├── components/
│   ├── ChatInput.tsx       # Message input with mode selector
│   ├── ChatWindow.tsx      # Message display area
│   ├── MessageBubble.tsx   # Individual message component
│   ├── SessionSidebar.tsx   # Session management sidebar
│   ├── SettingsPanel.tsx   # Settings modal (MCP servers, LLM config)
│   └── HealthStatus.tsx    # Backend health indicator
├── lib/
│   ├── api.ts              # API client functions
│   └── store.ts            # Zustand state management
└── types/                  # TypeScript type definitions
```

## Usage

### Chat Interface

1. **Select Mode**: Choose between "Agent" (with tools) or "RAG" (retrieval-only)
2. **Type Message**: Enter your message in the input field
3. **Send**: Press Enter or click the send button
4. **View Response**: AI responses stream in real-time with markdown rendering

### Session Management

- **Create New Session**: Click "New Session" in the sidebar
- **Switch Sessions**: Click any session in the sidebar to load its history
- **Delete Session**: Click the trash icon on any session

### Settings

Open the settings panel (gear icon in header) to:

1. **MCP Servers Tab**:
   - Add new MCP servers (name, URL, optional API key)
   - Edit existing servers
   - Delete servers
   - View configured servers

2. **LLM Config Tab**:
   - Select LLM type (OpenAI, Groq, Ollama, Gemini)
   - Configure model name
   - Set API keys (for OpenAI/Groq/Gemini)
   - Set base URL (for Ollama)
   - View current configuration

3. **Tools Tab**:
   - View available local tools
   - View connected MCP servers and their status

## API Integration

The frontend communicates with the backend through these endpoints:

- `POST /api/chat` - Non-streaming chat
- `POST /api/chat/stream` - Streaming chat (SSE)
- `GET /api/sessions` - List all sessions
- `GET /api/session/{id}` - Get session history
- `DELETE /api/session/{id}` - Delete session
- `GET /api/mcp-servers` - List MCP servers
- `POST /api/mcp-servers` - Add MCP server
- `PUT /api/mcp-servers/{name}` - Update MCP server
- `DELETE /api/mcp-servers/{name}` - Delete MCP server
- `GET /api/llm-config` - Get LLM configuration
- `POST /api/llm-config` - Set LLM configuration
- `GET /api/tools` - Get available tools
- `GET /health` - Health check

See the backend [API documentation](../mcp-server/README.md) for details.

## Tech Stack

- **Framework**: Next.js 16 (App Router) with TypeScript
- **Styling**: TailwindCSS v4
- **State Management**: Zustand
- **HTTP Client**: Fetch API
- **SSE Streaming**: EventSource API
- **Markdown**: react-markdown
- **Notifications**: react-hot-toast
- **Icons**: Lucide React

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
