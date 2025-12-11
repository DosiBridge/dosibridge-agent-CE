/**
 * Zustand store for application state
 */

import { create } from "zustand";
import {
  deleteSession as deleteSessionApi,
  getCurrentUser,
  getHealth,
  getLLMConfig,
  getSession,
  HealthStatus,
  listMCPServers,
  listSessions,
  LLMConfigResponse,
  login,
  LoginRequest,
  logout,
  MCPServer,
  register,
  RegisterRequest,
  Session,
  User,
} from "./api";
import {
  createStoredSession,
  deleteStoredSession,
  getOrCreateDefaultSession,
  getStoredMessages,
  getStoredSessions,
  saveStoredMessages,
  StoredMessage,
  updateStoredSessionTitle,
  clearAllStoredSessions,
} from "./sessionStorage";

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
  tools_used?: string[];
  sources?: { title: string; url?: string }[];
}

interface AppState {
  // Auth
  user: User | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  accountInactive: boolean; // Track if account is inactive to prevent repeated API calls

  // Current session
  currentSessionId: string;
  messages: Message[];
  isLoading: boolean;
  isStreaming: boolean;
  streamingStatus: "thinking" | "tool_calling" | "answering" | null;
  activeTools: string[]; // Currently active tools being used
  streamingStartTime: number | null;
  mode: "agent" | "rag";

  // RAG settings
  useReact: boolean;
  selectedCollectionId: number | null;
  ragSettingsOpen: boolean;

  // Sessions
  sessions: Session[];
  sessionsLoading: boolean;

  // Settings
  mcpServers: MCPServer[];
  llmConfig: LLMConfigResponse | null;
  health: HealthStatus | null;
  settingsOpen: boolean;

  // Theme
  theme: "light" | "dark" | "system";
  setTheme: (theme: "light" | "dark" | "system") => void;

  // Superadmin check
  isSuperadmin: () => boolean;
  getActualUserRole: () => string | null;

  // Auth actions
  checkAuth: () => Promise<void>;
  handleLogin: (data: LoginRequest, persistentAccess?: boolean) => Promise<void>;
  handleRegister: (data: RegisterRequest) => Promise<void>;
  handleLogout: () => Promise<void>;
  togglePersistentAccess: (enabled: boolean) => Promise<void>;

  // Actions
  setCurrentSession: (sessionId: string) => void;
  addMessage: (message: Omit<Message, "id" | "timestamp">) => void;
  updateLastMessage: (content: string) => void;
  updateLastMessageTools: (tools: string[]) => void;
  clearMessages: () => void;
  setLoading: (loading: boolean) => void;
  setStreaming: (streaming: boolean) => void;
  setStreamingStatus: (
    status: "thinking" | "tool_calling" | "answering" | null
  ) => void;
  addActiveTool: (tool: string) => void;
  clearActiveTools: () => void;
  setStreamingStartTime: (time: number | null) => void;
  setMode: (mode: "agent" | "rag") => void;
  setUseReact: (useReact: boolean) => void;
  setSelectedCollectionId: (collectionId: number | null) => void;
  setRagSettingsOpen: (open: boolean) => void;

  // Session actions
  loadSessions: () => Promise<void>;
  loadSession: (sessionId: string) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  createNewSession: () => void;
  updateSessionTitle: (sessionId: string, title: string) => Promise<void>;
  saveCurrentSessionMessages: () => void;

  // Settings actions
  loadMCPServers: () => Promise<void>;
  loadLLMConfig: () => Promise<void>;
  loadHealth: () => Promise<void>;
  setHealth: (health: HealthStatus | null) => void;
  setSettingsOpen: (open: boolean) => void;

  // Impersonation
  impersonatedUserId: string | null;
  originalSuperadminId: string | null; // Store original superadmin ID to switch back
  originalSuperadminRole: string | null; // Store original superadmin role to maintain permissions
  setImpersonatedUserId: (userId: string | null) => void;
}

const generateId = () =>
  `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useStore = create<AppState>((set, get) => ({
  // Initial state
  user: null,
  isAuthenticated: false,
  authLoading: true,
  accountInactive: false,
  currentSessionId: "default",
  messages: [],
  isLoading: false,
  isStreaming: false,
  streamingStatus: null,
  activeTools: [],
  streamingStartTime: null,
  mode: "agent", // Default to agent mode
  useReact: false,
  selectedCollectionId: null,
  ragSettingsOpen: false,
  sessions: [],
  sessionsLoading: false,
  mcpServers: [],
  llmConfig: null,
  health: null,
  settingsOpen: false,

  // Impersonation (Superadmin)
  impersonatedUserId: null,
  originalSuperadminId: null,
  originalSuperadminRole: null,
  setImpersonatedUserId: (userId: string | null) => {
    const currentState = get();

    // If starting impersonation, store the original superadmin ID and role
    if (userId && !currentState.impersonatedUserId) {
      // Store the current user's ID and role as the original superadmin
      // This allows switching back to superadmin view and maintaining permissions
      if (currentState.user?.id) {
        set({ 
          originalSuperadminId: currentState.user.id.toString(),
          originalSuperadminRole: currentState.user.role || null
        });
      }
    }

    // If exiting impersonation or switching back to superadmin, clear the original superadmin ID and role
    if (!userId || userId === currentState.originalSuperadminId) {
      set({ originalSuperadminId: null, originalSuperadminRole: null });
    }
    // Clear local storage as requested to ensure fresh state
    clearAllStoredSessions();

    // Reset state to avoid showing stale data while loading
    set({
      impersonatedUserId: userId,
      messages: [],
      sessions: [],
      currentSessionId: "default",
      mcpServers: [],
      llmConfig: null,
      health: null
    });

    // Create a fresh default session in storage so app doesn't crash on reload
    getOrCreateDefaultSession();

    // Suppress console errors for permission errors during impersonation
    // This prevents "Superadmin access required" errors from cluttering the console
    const originalConsoleError = console.error;
    const suppressPermissionErrors = (userId: string | null) => {
      if (userId) {
        console.error = (...args: any[]) => {
          const errorMessage = args[0]?.toString() || '';
          const isPermissionError =
            errorMessage.includes("Superadmin access required") ||
            errorMessage.includes("Superadmin") && errorMessage.includes("required") ||
            args.some(arg =>
              arg?.message?.includes("Superadmin") ||
              arg?.detail?.includes("Superadmin") ||
              arg?.isPermissionError
            );

          if (!isPermissionError) {
            originalConsoleError.apply(console, args);
          }
        };
      } else {
        // Restore original console.error when exiting impersonation
        console.error = originalConsoleError;
      }
    };

    suppressPermissionErrors(userId);

    // Reload data when switching users
    const isAuthenticated = get().isAuthenticated;
    if (isAuthenticated) {
      // Immediately reload user data to get impersonated user info
      setTimeout(() => {
        get().checkAuth(); // Re-fetch user profile (will return impersonated user when header is set)
        // checkAuth will automatically trigger loadSessions() and loadMCPServers()
        // Restore console.error after a delay to allow errors to be suppressed
        setTimeout(() => {
          if (!get().impersonatedUserId) {
            console.error = originalConsoleError;
          }
        }, 2000);
      }, 100);
    } else {
      // Restore console.error if not authenticated
      setTimeout(() => {
        console.error = originalConsoleError;
      }, 100);
    }
  },

  // Initialize: ensure default session exists and load it
  ...(() => {
    if (typeof window !== "undefined") {
      getOrCreateDefaultSession();
    }
    return {};
  })(),

  // Theme initialization - will be set properly on client side
  theme: "system" as "light" | "dark" | "system",

  // Auth actions
  checkAuth: async () => {
    set({ authLoading: true });
    try {
      const user = await getCurrentUser();
      // Allow blocked users to login but mark them as blocked
      set({ user, isAuthenticated: true, authLoading: false });
      
      // If user is blocked, don't load sessions/MCP servers
      if (user && !user.is_active) {
        // User is blocked - they can still login but cannot use features
        set({ accountInactive: true });
        import("react-hot-toast").then(({ toast }) => {
          toast.error("Your account is blocked. You can send a message to superadmin to request unblocking.");
        });
        return;
      }
      // Reset inactive flag if user is active
      set({ accountInactive: false });
      
      // Load user-specific data after authentication check (only for active users)
      // Use setTimeout to ensure state is updated before loading
      setTimeout(() => {
        get().loadSessions();
        get().loadMCPServers();
      }, 0);
    } catch (error: any) {
      // Handle blocked user scenario (403 Forbidden with specific message)
      // Try to get user info even if blocked
      if (
        error?.statusCode === 403 ||
        (error?.message && error.message.includes("User account is inactive")) ||
        (error?.detail && error.detail.includes("User account is inactive"))
      ) {
        // Try to fetch user info using get_current_user (not get_current_active_user)
        // This should work now that we changed /api/auth/me to use get_current_user
        try {
          const user = await getCurrentUser();
          if (user && !user.is_active) {
            set({ user, isAuthenticated: true, authLoading: false, accountInactive: true });
            import("react-hot-toast").then(({ toast }) => {
              toast.error("Your account is blocked. You can send a message to superadmin to request unblocking.");
            });
            return;
          }
        } catch (retryError) {
          // If still fails, log them out
          console.error("User account is blocked:", error);
          import("react-hot-toast").then(({ toast }) => {
            toast.error("This account is blocked by superadmin");
          });
          set({ user: null, isAuthenticated: false, authLoading: false });
          return;
        }
      }

      // Not authenticated - this is fine for agent mode
      // Silently handle expected 401 errors (user not logged in)
      // Only log unexpected errors
      if (error && !error.isUnauthenticated) {
        console.error("Unexpected error during auth check:", error);
      }
      set({ user: null, isAuthenticated: false, authLoading: false });
      // RAG mode requires authentication - switch to agent mode if in RAG (agent works without login)
      const currentMode = get().mode;
      if (currentMode === "rag") {
        set({ mode: "agent" }); // Switch to agent mode (agent works without login)
      }
      // Clear MCP servers when not authenticated (agent mode works without MCP)
      set({ mcpServers: [] });
      // Load browser sessions for agent mode (works without login)
      setTimeout(() => {
        get().loadSessions();
      }, 0);
    }
  },

  handleLogin: async (data: LoginRequest, persistentAccess: boolean = false) => {
    const result = await login(data, persistentAccess);
    set({ user: result.user, isAuthenticated: true });
    // Load user-specific data after login
    // Use setTimeout to ensure state is updated before loading
    setTimeout(() => {
      get().loadSessions();
      get().loadMCPServers();
    }, 0);
  },

  handleRegister: async (data: RegisterRequest, persistentAccess: boolean = false) => {
    const result = await register(data, persistentAccess);
    set({ user: result.user, isAuthenticated: true });
    // Load user-specific data after registration
    // Use setTimeout to ensure state is updated before loading
    setTimeout(() => {
      get().loadSessions();
      get().loadMCPServers();
    }, 0);
  },

  handleLogout: async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      // Clear all messages and session history from local storage
      clearAllStoredSessions();

      // Clear all MCP-related data and health status
      set({
        user: null,
        isAuthenticated: false,
        messages: [], // Clear all messages on logout
        sessions: [], // Clear all sessions on logout
        currentSessionId: "default", // Reset to default session
        mcpServers: [], // Clear MCP servers list on logout
        health: null, // Clear health status on logout
        mode: "agent", // Reset to agent mode
        isStreaming: false, // Stop any ongoing streaming
        isLoading: false, // Stop any ongoing loading
        useReact: false, // Reset RAG settings
        selectedCollectionId: null, // Reset RAG collection
      });

      // Create a fresh default session for agent mode
      getOrCreateDefaultSession();

      // Note: WebSocket will automatically disconnect and reconnect via useEffect in page.tsx
      // when isAuthenticated changes to false
    }
  },

  togglePersistentAccess: async (enabled: boolean) => {
    const { user, isAuthenticated } = get();
    if (!isAuthenticated || !user || user.role !== "superadmin") {
      throw new Error("Persistent access is only available for superadmin users");
    }

    // Import storage utilities
    const { enablePersistentAccess, disablePersistentAccess, getAuthToken } = await import("./storage/authStorage");

    if (enabled) {
      enablePersistentAccess();
      // Move token to localStorage if it exists
      const token = getAuthToken();
      if (token) {
        const { setAuthToken } = await import("./api/client");
        setAuthToken(token, true, true);
      }
    } else {
      disablePersistentAccess();
      // Move token to sessionStorage
      const token = getAuthToken();
      if (token) {
        const { setAuthToken } = await import("./api/client");
        setAuthToken(token, true, false);
      }
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
      messages: [],
    });
    get().loadSessions();
  },

  deleteSession: async (sessionId: string) => {
    // 1. Delete from local storage (always works)
    deleteStoredSession(sessionId);

    // 2. Update state to remove session
    set((state) => ({
      sessions: state.sessions.filter((s) => s.session_id !== sessionId),
    }));

    // 3. If current session was deleted, switch to another
    if (get().currentSessionId === sessionId) {
      const sessions = get().sessions;
      if (sessions.length > 0) {
        get().setCurrentSession(sessions[0].session_id);
      } else {
        get().createNewSession();
      }
    }

    // 4. Delete from backend if authenticated
    const isAuthenticated = get().isAuthenticated;
    if (isAuthenticated) {
      try {
        await deleteSessionApi(sessionId);
      } catch (error) {
        console.error("Failed to delete session from backend:", error);
        // Continue anyway since we deleted locally
      }
    }
  },

  updateSessionTitle: async (sessionId: string, title: string) => {
    // Update in local storage
    updateStoredSessionTitle(sessionId, title);

    // Update in backend if authenticated
    const isAuthenticated = get().isAuthenticated;
    if (isAuthenticated) {
      try {
        const { updateSession } = await import("./api/sessions");
        await updateSession(sessionId, title);
      } catch (error) {
        console.error("Failed to update session title in backend:", error);
        // Continue anyway since we updated locally
      }
    }

    // Reload sessions to reflect changes
    get().loadSessions();
  },

  saveCurrentSessionMessages: () => {
    const state = get();
    if (state.messages.length > 0) {
      const storedMessages: StoredMessage[] = state.messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
        sources: msg.sources,
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
      const storedMessages: StoredMessage[] = updatedMessages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
        sources: msg.sources,
      }));
      saveStoredMessages(state.currentSessionId, storedMessages);

      return { messages: updatedMessages };
    });
  },

  updateLastMessage: (content: string) => {
    set((state) => {
      const messages = [...state.messages];
      if (
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant"
      ) {
        const lastMessage = messages[messages.length - 1];
        messages[messages.length - 1] = {
          ...lastMessage,
          content: lastMessage.content + content,
        };
      } else if (content) {
        // If no assistant message exists, create one
        messages.push({
          id: generateId(),
          role: "assistant",
          content: content,
          timestamp: new Date(),
        });
      }

      // Auto-save to browser storage
      const storedMessages: StoredMessage[] = messages.map((msg) => ({
        id: msg.id,
        role: msg.role,
        content: msg.content,
        timestamp: msg.timestamp.getTime(),
        tools_used: msg.tools_used,
        sources: msg.sources,
      }));
      saveStoredMessages(state.currentSessionId, storedMessages);

      return { messages };
    });
  },

  updateLastMessageTools: (tools: string[]) => {
    set((state) => {
      const messages = [...state.messages];
      if (
        messages.length > 0 &&
        messages[messages.length - 1].role === "assistant"
      ) {
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
    if (streaming) {
      set({
        isStreaming: streaming,
        streamingStartTime: Date.now(),
        streamingStatus: "thinking",
        activeTools: [],
      });
    } else {
      set({
        isStreaming: streaming,
        streamingStatus: null,
        activeTools: [],
        streamingStartTime: null,
      });
    }
  },

  setStreamingStatus: (
    status: "thinking" | "tool_calling" | "answering" | null
  ) => {
    set({ streamingStatus: status });
  },

  addActiveTool: (tool: string) => {
    set((state) => ({
      activeTools: [...state.activeTools.filter((t) => t !== tool), tool],
    }));
  },

  clearActiveTools: () => {
    set({ activeTools: [] });
  },

  setStreamingStartTime: (time: number | null) => {
    set({ streamingStartTime: time });
  },

  setMode: (mode: "agent" | "rag") => {
    const state = get();
    // RAG mode requires authentication (Agent mode works without login)
    if (mode === "rag" && !state.isAuthenticated) {
      console.warn("Cannot switch to RAG mode: authentication required");
      return; // Don't change mode if not authenticated
    }
    set({ mode });
  },
  setUseReact: (useReact: boolean) => {
    set({ useReact });
  },
  setSelectedCollectionId: (collectionId: number | null) => {
    set({ selectedCollectionId: collectionId });
  },
  setRagSettingsOpen: (open: boolean) => {
    set({ ragSettingsOpen: open });
  },

  // Load sessions - combines browser storage with backend (if authenticated)
  // When impersonating, only loads from backend (impersonated user's sessions)
  loadSessions: async () => {
    set({ sessionsLoading: true });
    try {
      const isAuthenticated = get().isAuthenticated;
      const impersonatedUserId = get().impersonatedUserId;

      // When impersonating, only load from backend (don't use browser storage)
      if (impersonatedUserId && isAuthenticated) {
        try {
          const backendData = await listSessions();
          // When impersonating, use backend sessions directly (they belong to the impersonated user)
          // Ensure we get ALL sessions from backend
          const backendSessions: Session[] = backendData.sessions.map((s) => ({
            session_id: s.session_id,
            title: s.title || `Session ${s.session_id.slice(-8)}`,
            summary: s.summary,
            message_count: s.message_count || 0,
            updated_at: s.updated_at,
          }));

          // Sort by updated_at descending (most recent first)
          backendSessions.sort((a, b) => {
            if (!a.updated_at && !b.updated_at) return 0;
            if (!a.updated_at) return 1;
            if (!b.updated_at) return -1;
            return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
          });

          set({ sessions: backendSessions, sessionsLoading: false });
          return;
        } catch (error) {
          console.error("Failed to load sessions for impersonated user:", error);
          set({ sessions: [], sessionsLoading: false });
          return;
        }
      }

      // Normal flow: combine browser storage with backend
      const storedSessions = getStoredSessions();

      if (isAuthenticated) {
        // If authenticated, try to sync with backend
        try {
          const backendData = await listSessions();
          // Merge: prefer browser storage for titles, backend for message counts and summary
          // IMPORTANT: Only include sessions that exist in browser storage to respect deletions
          const mergedSessions: Session[] = storedSessions.map((stored) => {
            const backend = backendData.sessions.find(
              (s) => s.session_id === stored.id
            );
            return {
              session_id: stored.id,
              title: stored.title,
              summary: backend?.summary,
              message_count: backend?.message_count || stored.messageCount || 0,
              updated_at: backend?.updated_at,
            };
          });

          // DO NOT add backend sessions that aren't in browser storage
          // This prevents deleted sessions from being re-added on page reload
          // If a session was deleted from browser storage, it should stay deleted

          set({ sessions: mergedSessions, sessionsLoading: false });
        } catch (error: any) {
          // Check if error is due to inactive account
          if (error?.isInactiveAccount || (error?.message && error.message.includes("User account is inactive"))) {
            set({ accountInactive: true, sessions: [], sessionsLoading: false });
            return;
          }
          // If backend fails, use browser storage
          console.warn(
            "Failed to load sessions from backend, using browser storage:",
            error
          );
          const browserSessions: Session[] = storedSessions.map((s) => ({
            session_id: s.id,
            message_count: s.messageCount,
          }));
          set({ sessions: browserSessions, sessionsLoading: false });
        }
      } else {
        // Not authenticated - use browser storage only
        const browserSessions: Session[] = storedSessions.map((s) => ({
          session_id: s.id,
          message_count: s.messageCount,
        }));
        set({ sessions: browserSessions, sessionsLoading: false });
      }
    } catch (error) {
      console.error("Failed to load sessions:", error);
      set({ sessionsLoading: false });
    }
  },

  // Load a specific session - from browser storage first, then backend if authenticated
  // When impersonating, only loads from backend (impersonated user's session)
  loadSession: async (sessionId: string) => {
    try {
      set({ isLoading: true });

      const impersonatedUserId = get().impersonatedUserId;
      const isAuthenticated = get().isAuthenticated;

      // When impersonating, only load from backend (don't use browser storage)
      if (impersonatedUserId && isAuthenticated) {
        try {
          const sessionInfo = await getSession(sessionId);
          const messages: Message[] = sessionInfo.messages.map(
            (msg, idx) => ({
              id: `${sessionId}-${idx}-${msg.created_at || Date.now()}`,
              role: msg.role,
              content: msg.content,
              timestamp: msg.created_at ? new Date(msg.created_at) : new Date(),
              tools_used: msg.tools_used || [],
              sources: (msg.sources || []).map((s: any) => ({
                title: s.title || "Source",
                url: s.url,
              })),
            })
          );
          set({ messages, isLoading: false });
          return;
        } catch (error) {
          console.error("Failed to load session from backend for impersonated user:", error);
          set({ messages: [], isLoading: false });
          return;
        }
      }

      // Normal flow: try browser storage first
      const storedMessages = getStoredMessages(sessionId);

      if (storedMessages.length > 0) {
        // Convert stored messages to Message format
        const messages: Message[] = storedMessages.map((msg) => ({
          id: msg.id,
          role: msg.role,
          content: msg.content,
          timestamp: new Date(msg.timestamp),
          tools_used: msg.tools_used,
          sources: msg.sources,
        }));
        set({ messages, isLoading: false });
      } else {
        // If no browser storage, check if session exists in stored sessions list
        // If it doesn't exist in the list, it was likely deleted - don't restore from backend
        const storedSessions = getStoredSessions();
        const sessionExists = storedSessions.some((s) => s.id === sessionId);

        if (!sessionExists) {
          // Session was deleted from browser storage - don't restore from backend
          console.log(
            `Session ${sessionId} not found in browser storage - not restoring from backend`
          );
          set({ messages: [], isLoading: false });
          return;
        }

        // Session exists in list but has no messages - try backend (if authenticated)
        if (isAuthenticated) {
          try {
            const sessionInfo = await getSession(sessionId);
            const messages: Message[] = sessionInfo.messages.map(
              (msg, idx) => ({
                id: `${sessionId}-${idx}-${Date.now()}`,
                role: msg.role,
                content: msg.content,
                timestamp: new Date(),
              })
            );

            // Save to browser storage
            const storedMessages: StoredMessage[] = messages.map((msg) => ({
              id: msg.id,
              role: msg.role,
              content: msg.content,
              timestamp: msg.timestamp.getTime(),
              tools_used: msg.tools_used,
              sources: msg.sources,
            }));
            saveStoredMessages(sessionId, storedMessages);

            set({ messages, isLoading: false });
          } catch (error) {
            console.error("Failed to load session from backend:", error);
            set({ messages: [], isLoading: false });
          }
        } else {
          // No browser storage and not authenticated - empty session
          set({ messages: [], isLoading: false });
        }
      }
    } catch (error) {
      console.error("Failed to load session:", error);
      set({ messages: [], isLoading: false });
    }
  },

  // Settings
  loadMCPServers: async () => {
    const { isAuthenticated, accountInactive, user } = get();
    if (!isAuthenticated) {
      // Not authenticated - clear MCP servers (no access without login)
      set({ mcpServers: [] });
      return;
    }

    // Don't load MCP servers if account is inactive
    if (accountInactive || (user && !user.is_active)) {
      set({ mcpServers: [] });
      return;
    }

    try {
      const data = await listMCPServers();
      set({ mcpServers: data.servers });
    } catch (error: any) {
      // Check if error is due to inactive account
      if (error?.isInactiveAccount || (error?.message && error.message.includes("User account is inactive"))) {
        set({ accountInactive: true, mcpServers: [] });
        return;
      }
      console.error("Failed to load MCP servers:", error);
      // On error, clear MCP servers list
      set({ mcpServers: [] });
    }
  },

  loadLLMConfig: async () => {
    try {
      const data = await getLLMConfig();
      set({ llmConfig: data.config });
    } catch (error) {
      console.error("Failed to load LLM config:", error);
    }
  },

  loadHealth: async () => {
    try {
      const health = await getHealth();
      set({ health });
    } catch (error) {
      console.error("Failed to load health:", error);
    }
  },

  setHealth: (health: HealthStatus | null) => {
    set({ health });
  },

  setSettingsOpen: (open: boolean) => {
    set({ settingsOpen: open });
  },

  setTheme: (theme: "light" | "dark" | "system") => {
    set({ theme });
    if (typeof window !== "undefined") {
      try {
        localStorage.setItem("theme", theme);
        // Apply theme to HTML element immediately
        const root = document.documentElement;
        let actualTheme: "light" | "dark";

        if (theme === "system") {
          // Use system preference
          actualTheme = window.matchMedia("(prefers-color-scheme: dark)")
            .matches
            ? "dark"
            : "light";
        } else {
          actualTheme = theme;
        }

        if (actualTheme === "dark") {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      } catch (error) {
        console.error("Failed to set theme:", error);
      }
    }
  },

  // Superadmin check - checks actual logged-in user, not impersonated user
  isSuperadmin: () => {
    const { user, impersonatedUserId, originalSuperadminRole } = get();
    // If impersonating, check the original superadmin's role, not the impersonated user's role
    if (impersonatedUserId && originalSuperadminRole) {
      return originalSuperadminRole === "superadmin";
    }
    // Otherwise check the current user's role
    return user?.role === "superadmin" || user?.is_superadmin === true;
  },
  
  // Get the actual logged-in user's role (not impersonated)
  getActualUserRole: () => {
    const { impersonatedUserId, originalSuperadminRole, user } = get();
    // If impersonating, return the original superadmin's role
    if (impersonatedUserId && originalSuperadminRole) {
      return originalSuperadminRole;
    }
    // Otherwise return the current user's role
    return user?.role || null;
  },
}));

// Initialize theme on client side - this runs when the module loads
if (typeof window !== "undefined") {
  try {
    // Get theme from localStorage or use system
    const stored = localStorage.getItem("theme");
    const themePreference: "light" | "dark" | "system" =
      stored === "light" || stored === "dark" || stored === "system"
        ? stored
        : "system";

    // Determine actual theme to apply
    let actualTheme: "light" | "dark" = "dark";
    if (themePreference === "system") {
      actualTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
    } else {
      actualTheme = themePreference;
    }

    // Apply theme to HTML element immediately (before React hydrates)
    const root = document.documentElement;
    if (actualTheme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }

    // Set theme preference in store
    useStore.setState({ theme: themePreference });

    // Listen for system theme changes if using system preference
    if (themePreference === "system") {
      const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
      const handleSystemThemeChange = (e: MediaQueryListEvent) => {
        const root = document.documentElement;
        if (e.matches) {
          root.classList.add("dark");
        } else {
          root.classList.remove("dark");
        }
      };
      mediaQuery.addEventListener("change", handleSystemThemeChange);
    }
  } catch (error) {
    // If there's an error, default to dark mode
    document.documentElement.classList.add("dark");
    useStore.setState({ theme: "dark" });
  }
}
