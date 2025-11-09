/**
 * Zustand store for application state
 */

import { create } from 'zustand';
import { getHealth, getLLMConfig, getSession, HealthStatus, listMCPServers, listSessions, LLMConfigResponse, MCPServer, Session } from './api';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tools_used?: string[];
}

interface AppState {
  // Current session
  currentSessionId: string;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  mode: 'agent' | 'rag';
  
  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;
  
  // Settings
  mcpServers: MCPServer[];
  llmConfig: LLMConfigResponse | null;
  health: HealthStatus | null;
  settingsOpen: boolean;
  
  // Actions
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
  updateLastMessage: (content: string) => void;
  updateLastMessageTools: (tools: string[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setMode: (mode: 'agent' | 'rag') => void;
  
  // Session actions
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  createNewSession: () => void;
  
  // Settings actions
  loadMCPServers: () => Promise<void>;
  loadLLMConfig: () => Promise<void>;
  loadHealth: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  currentSessionId: 'default',
  messages: [],
  isLoading: false,
  isStreaming: false,
  mode: 'agent',
  sessions: [],
  sessionsLoading: false,
  mcpServers: [],
  llmConfig: null,
  health: null,
  settingsOpen: false,
  
  // Session management
  setCurrentSession: (sessionId: string) => {
    const currentId = get().currentSessionId;
    if (currentId !== sessionId) {
      set({ currentSessionId: sessionId });
      get().loadSession(sessionId);
    }
  },
  
  createNewSession: () => {
    const newSessionId = `session-${Date.now()}`;
    set({ 
      currentSessionId: newSessionId,
      messages: []
    });
    get().loadSessions();
  },
  
  // Message management
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    set((state) => ({
      messages: [...state.messages, newMessage],
    }));
  },
  
  updateLastMessage: (content: string) => {
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        const lastMessage = messages[messages.length - 1];
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + content,
        };
      } else if (content) {
        // If no assistant message exists, create one
        messages.push({
          id: generateId(),
          role: 'assistant',
          content: content,
          timestamp: new Date(),
        });
      }
      return { messages };
    });
  },
  
  updateLastMessageTools: (tools: string[]) => {
    set((state) => {
      const messages = [...state.messages];
      if (messages.length > 0 && messages[messages.length - 1].role === 'assistant') {
        messages[messages.length - 1] = {
          ...messages[messages.length - 1],
          tools_used: tools,
        };
      }
      return { messages };
    });
  },
  
  clearMessages: () => {
    set({ messages: [] });
  },
  
  setLoading: (loading: boolean) => {
    set({ isLoading: loading });
  },
  
  setStreaming: (streaming: boolean) => {
    set({ isStreaming: streaming });
  },
  
  setMode: (mode: 'agent' | 'rag') => {
    set({ mode });
  },
  
  // Load sessions
  loadSessions: async () => {
    set({ sessionsLoading: true });
    try {
      const data = await listSessions();
      set({ sessions: data.sessions, sessionsLoading: false });
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ sessionsLoading: false });
    }
  },
  
  // Load a specific session
  loadSession: async (sessionId: string) => {
    try {
      set({ isLoading: true });
      const sessionInfo = await getSession(sessionId);
      const messages: Message[] = sessionInfo.messages.map((msg, idx) => ({
        id: `${sessionId}-${idx}-${Date.now()}`,
        role: msg.role,
        content: msg.content,
        timestamp: new Date(),
      }));
      set({ messages, isLoading: false });
    } catch (error) {
      console.error('Failed to load session:', error);
      set({ messages: [], isLoading: false });
    }
  },
  
  // Settings
  loadMCPServers: async () => {
    try {
      const data = await listMCPServers();
      set({ mcpServers: data.servers });
    } catch (error) {
      console.error('Failed to load MCP servers:', error);
    }
  },
  
  loadLLMConfig: async () => {
    try {
      const data = await getLLMConfig();
      set({ llmConfig: data.config });
    } catch (error) {
      console.error('Failed to load LLM config:', error);
    }
  },
  
  loadHealth: async () => {
    try {
      const health = await getHealth();
      set({ health });
    } catch (error) {
      console.error('Failed to load health:', error);
    }
  },
  
  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open });
  },
}));

