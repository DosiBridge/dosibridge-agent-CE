/**
 * Browser-based session storage for chat sessions
 * Stores sessions and messages in localStorage
 */

export interface StoredSession {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  messageCount: number;
  firstMessage?: string; // First user message for title
}

export interface StoredMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  tools_used?: string[];
}

const SESSIONS_KEY = "chat_sessions";
const MESSAGES_PREFIX = "session_messages_";

/**
 * Get all stored sessions
 */
export function getStoredSessions(): StoredSession[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(SESSIONS_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error("Failed to load sessions from storage:", error);
    return [];
  }
}

/**
 * Save sessions to storage
 */
export function saveStoredSessions(sessions: StoredSession[]): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(SESSIONS_KEY, JSON.stringify(sessions));
  } catch (error) {
    console.error("Failed to save sessions to storage:", error);
  }
}

/**
 * Get messages for a session
 */
export function getStoredMessages(sessionId: string): StoredMessage[] {
  if (typeof window === "undefined") return [];

  try {
    const data = localStorage.getItem(`${MESSAGES_PREFIX}${sessionId}`);
    if (!data) return [];
    return JSON.parse(data);
  } catch (error) {
    console.error(`Failed to load messages for session ${sessionId}:`, error);
    return [];
  }
}

/**
 * Save messages for a session
 */
export function saveStoredMessages(
  sessionId: string,
  messages: StoredMessage[]
): void {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      `${MESSAGES_PREFIX}${sessionId}`,
      JSON.stringify(messages)
    );

    // Update session metadata
    const sessions = getStoredSessions();
    const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
    if (sessionIndex >= 0) {
      sessions[sessionIndex].messageCount = messages.length;
      sessions[sessionIndex].updatedAt = Date.now();

      // Update title from first user message if not set
      if (!sessions[sessionIndex].firstMessage && messages.length > 0) {
        const firstUserMessage = messages.find((m) => m.role === "user");
        if (firstUserMessage) {
          sessions[sessionIndex].firstMessage = firstUserMessage.content;
          sessions[sessionIndex].title =
            firstUserMessage.content.slice(0, 50) || "New Chat";
        }
      }

      saveStoredSessions(sessions);
    }
  } catch (error) {
    console.error(`Failed to save messages for session ${sessionId}:`, error);
  }
}

/**
 * Create a new session
 */
export function createStoredSession(
  sessionId: string,
  title?: string
): StoredSession {
  const session: StoredSession = {
    id: sessionId,
    title: title || "New Chat",
    createdAt: Date.now(),
    updatedAt: Date.now(),
    messageCount: 0,
  };

  const sessions = getStoredSessions();
  sessions.unshift(session); // Add to beginning
  saveStoredSessions(sessions);

  return session;
}

/**
 * Update session title
 */
export function updateStoredSessionTitle(
  sessionId: string,
  title: string
): void {
  const sessions = getStoredSessions();
  const sessionIndex = sessions.findIndex((s) => s.id === sessionId);
  if (sessionIndex >= 0) {
    sessions[sessionIndex].title = title;
    sessions[sessionIndex].updatedAt = Date.now();
    saveStoredSessions(sessions);
  }
}

/**
 * Delete a session and its messages
 */
export function deleteStoredSession(sessionId: string): void {
  if (typeof window === "undefined") return;

  try {
    // Remove messages first
    localStorage.removeItem(`${MESSAGES_PREFIX}${sessionId}`);

    // Remove from sessions list
    const sessions = getStoredSessions();
    const filtered = sessions.filter((s) => s.id !== sessionId);
    saveStoredSessions(filtered);

    // Force a storage event to ensure cleanup
    window.dispatchEvent(
      new StorageEvent("storage", {
        key: SESSIONS_KEY,
        newValue: JSON.stringify(filtered),
        oldValue: JSON.stringify(sessions),
      })
    );
  } catch (error) {
    console.error(`Failed to delete session ${sessionId}:`, error);
    // Try to at least remove from list even if messages fail
    try {
      const sessions = getStoredSessions();
      const filtered = sessions.filter((s) => s.id !== sessionId);
      saveStoredSessions(filtered);
    } catch (e) {
      console.error("Failed to remove session from list:", e);
    }
  }
}

/**
 * Clear all sessions (for logout)
 */
export function clearAllStoredSessions(): void {
  if (typeof window === "undefined") return;

  try {
    const sessions = getStoredSessions();
    // Delete all message storage
    sessions.forEach((session) => {
      localStorage.removeItem(`${MESSAGES_PREFIX}${session.id}`);
    });
    // Clear sessions list
    localStorage.removeItem(SESSIONS_KEY);
  } catch (error) {
    console.error("Failed to clear sessions:", error);
  }
}

/**
 * Get or create default session
 */
export function getOrCreateDefaultSession(): StoredSession {
  const sessions = getStoredSessions();
  const defaultSession = sessions.find((s) => s.id === "default");

  if (defaultSession) {
    return defaultSession;
  }

  return createStoredSession("default", "Default Chat");
}
