/**
 * Zustand store for application state
 */

import { create } from 'zustand';
import { getCurrentUser, getHealth, getLLMConfig, getSession, HealthStatus, listMCPServers, listSessions, LLMConfigResponse, login, LoginRequest, logout, MCPServer, register, RegisterRequest, Session, User } from './api';
import {
    createStoredSession,
    getOrCreateDefaultSession,
    getStoredMessages,
    getStoredSessions,
    saveStoredMessages,
    StoredMessage,
    updateStoredSessionTitle
} from './sessionStorage';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  tools_used?: string[];
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  
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
  
  // Auth actions
  checkAuth: () => Promise<void>;
  handleLogin: (data: LoginRequest) => Promise<void>;
  handleRegister: (data: RegisterRequest) => Promise<void>;
  handleLogout: () => Promise<void>;
  
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
  updateSessionTitle: (sessionId: string, title: string) => void;
  saveCurrentSessionMessages: () => void;
  
  // Settings actions
  loadMCPServers: () => Promise<void>;
  loadLLMConfig: () => Promise<void>;
  loadHealth: () => Promise<void>;
  setSettingsOpen: (open: boolean) => void;
}

const generateId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  authLoading: true,
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
  
  // Initialize: ensure default session exists and load it
  ...(() => {
    if (typeof window !== 'undefined') {
      getOrCreateDefaultSession();
    }
    return {};
  })(),
  
  // Auth actions
  checkAuth: async () => {
    set({ authLoading: true });
    try {
      const user = await getCurrentUser();
      set({ user, isAuthenticated: true, authLoading: false });
    } catch (error) {
      set({ user: null, isAuthenticated: false, authLoading: false });
    }
  },
  
  handleLogin: async (data: LoginRequest) => {
    try {
      const result = await login(data);
      set({ user: result.user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },
  
  handleRegister: async (data: RegisterRequest) => {
    try {
      const result = await register(data);
      set({ user: result.user, isAuthenticated: true });
    } catch (error) {
      throw error;
    }
  },
  
  handleLogout: async () => {
    try {
      // Save current session before logout
      get().saveCurrentSessionMessages();
      await logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // Don't clear browser storage on logout - keep sessions for when user logs back in
      set({ user: null, isAuthenticated: false, messages: [], sessions: [] });
      // Reload sessions from browser storage
      get().loadSessions();
    }
  },
  
  // Session management
  setCurrentSession: (sessionId: string) => {
    const currentId = get().currentSessionId;
    if (currentId !== sessionId) {
      // Save current session messages before switching
      get().saveCurrentSessionMessages();
      set({ currentSessionId: sessionId });
      get().loadSession(sessionId);
    }
  },
  
  createNewSession: () => {
    // Save current session before creating new one
    get().saveCurrentSessionMessages();
    
    const newSessionId = `session-${Date.now()}`;
    createStoredSession(newSessionId);
    set({ 
      currentSessionId: newSessionId,
      messages: []
    });
    get().loadSessions();
  },
  
  updateSessionTitle: (sessionId: string, title: string) => {
    updateStoredSessionTitle(sessionId, title);
    get().loadSessions();
  },
  
  saveCurrentSessionMessages: () => {
    const state = get();
    if (state.messages.length > 0) {
      const storedMessages: StoredMessage[] = state.messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
      }));
      saveStoredMessages(state.currentSessionId, storedMessages);
    }
  },
  
  // Message management
  addMessage: (message) => {
    const newMessage: Message = {
      ...message,
      id: generateId(),
      timestamp: new Date(),
    };
    set((state) => {
      const updatedMessages = [...state.messages, newMessage];
      
      // Auto-save to browser storage
      const storedMessages: StoredMessage[] = updatedMessages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
      }));
      saveStoredMessages(state.currentSessionId, storedMessages);
      
      return { messages: updatedMessages };
    });
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
      
      // Auto-save to browser storage
      const storedMessages: StoredMessage[] = messages.map(msg => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
      }));
      saveStoredMessages(state.currentSessionId, storedMessages);
      
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
  
  // Load sessions - combines browser storage with backend (if authenticated)
  loadSessions: async () => {
    set({ sessionsLoading: true });
    try {
      const isAuthenticated = get().isAuthenticated;
      
      // Always load from browser storage first
      const storedSessions = getStoredSessions();
      
      if (isAuthenticated) {
        // If authenticated, try to sync with backend
        try {
          const backendData = await listSessions();
          // Merge: prefer browser storage for titles, backend for message counts and summary
          const mergedSessions: Session[] = storedSessions.map(stored => {
            const backend = backendData.sessions.find(s => s.session_id === stored.id);
            return {
              session_id: stored.id,
              title: stored.title,
              summary: backend?.summary,
              message_count: backend?.message_count || stored.messageCount || 0,
              updated_at: backend?.updated_at,
            };
          });
          
          // Add backend sessions not in browser storage
          backendData.sessions.forEach(backend => {
            if (!storedSessions.find(s => s.id === backend.session_id)) {
              mergedSessions.push(backend);
            }
          });
          
          set({ sessions: mergedSessions, sessionsLoading: false });
        } catch (error) {
          // If backend fails, use browser storage
          console.warn('Failed to load sessions from backend, using browser storage:', error);
          const browserSessions: Session[] = storedSessions.map(s => ({
            session_id: s.id,
            message_count: s.messageCount,
          }));
          set({ sessions: browserSessions, sessionsLoading: false });
        }
      } else {
        // Not authenticated - use browser storage only
        const browserSessions: Session[] = storedSessions.map(s => ({
          session_id: s.id,
          message_count: s.messageCount,
        }));
        set({ sessions: browserSessions, sessionsLoading: false });
      }
    } catch (error) {
      console.error('Failed to load sessions:', error);
      set({ sessionsLoading: false });
    }
  },
  
  // Load a specific session - from browser storage first, then backend if authenticated
  loadSession: async (sessionId: string) => {
    try {
      set({ isLoading: true });
      
      // Always try browser storage first
      const storedMessages = getStoredMessages(sessionId);
      
      if (storedMessages.length > 0) {
        // Convert stored messages to Message format
        const messages: Message[] = storedMessages.map(msg => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tools_used: msg.tools_used,
        }));
        set({ messages, isLoading: false });
      } else {
        // If no browser storage, try backend (if authenticated)
        const isAuthenticated = get().isAuthenticated;
        if (isAuthenticated) {
          try {
            const sessionInfo = await getSession(sessionId);
            const messages: Message[] = sessionInfo.messages.map((msg, idx) => ({
              id: `${sessionId}-${idx}-${Date.now()}`,
              role: msg.role,
              content: msg.content,
              timestamp: new Date(),
            }));
            
            // Save to browser storage
            const storedMessages: StoredMessage[] = messages.map(msg => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.getTime(),
              tools_used: msg.tools_used,
            }));
            saveStoredMessages(sessionId, storedMessages);
            
            set({ messages, isLoading: false });
          } catch (error) {
            console.error('Failed to load session from backend:', error);
            set({ messages: [], isLoading: false });
          }
        } else {
          // No browser storage and not authenticated - empty session
          set({ messages: [], isLoading: false });
        }
      }
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

