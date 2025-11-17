/**
 * Session sidebar component
 */

"use client";

import { deleteAllSessions, deleteSession } from "@/lib/api";
import {
  clearAllStoredSessions,
  deleteStoredSession,
  getStoredSessions,
} from "@/lib/sessionStorage";
import { useStore } from "@/lib/store";
import {
  AlertTriangle,
  Edit2,
  MessageSquare,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";

interface SessionSidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

export default function SessionSidebar({
  isOpen = true,
  onClose,
}: SessionSidebarProps) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const user = useStore((state) => state.user);
  const sessions = useStore((state) => state.sessions);
  const sessionsLoading = useStore((state) => state.sessionsLoading);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const loadSessions = useStore((state) => state.loadSessions);
  const setCurrentSession = useStore((state) => state.setCurrentSession);
  const createNewSession = useStore((state) => state.createNewSession);
  const updateSessionTitle = useStore((state) => state.updateSessionTitle);

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const [deletingSession, setDeletingSession] = useState<string | null>(null);
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false);
  const [deletingAll, setDeletingAll] = useState(false);
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [isHovered, setIsHovered] = useState(false);

  // On desktop, sidebar is expanded if open OR hovered
  const isExpanded = isOpen || isHovered;

  const handleDeleteSession = async (
    sessionId: string,
    e: React.MouseEvent
  ) => {
    e.stopPropagation();
    setDeletingSession(sessionId);
  };

  const confirmDelete = async (sessionId: string) => {
    try {
      // Delete from backend if authenticated (permanent storage)
      if (isAuthenticated) {
        try {
          await deleteSession(sessionId);
        } catch (error) {
          // Continue to delete from browser storage even if backend fails
        }
      }

      // Always delete from browser storage (temporary storage)
      // This ensures cleanup even if not authenticated
      deleteStoredSession(sessionId);

      // If deleted session was current, clear messages and create a new one
      if (sessionId === currentSessionId) {
        // Clear current messages from store
        useStore.getState().clearMessages();
        createNewSession();
      }

      // Reload sessions list to reflect the deletion
      loadSessions();
      toast.success("Session deleted");
    } catch (error) {
      console.error("Error deleting session:", error);
      toast.error(
        `Failed to delete session: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setDeletingSession(null);
    }
  };

  const handleEditSession = (sessionId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const storedSessions = getStoredSessions();
    const session = storedSessions.find((s) => s.id === sessionId);
    setEditTitle(session?.title || sessionId);
    setEditingSession(sessionId);
  };

  const handleSaveEdit = (sessionId: string) => {
    if (editTitle.trim()) {
      updateSessionTitle(sessionId, editTitle.trim());
      toast.success("Session renamed");
    }
    setEditingSession(null);
    setEditTitle("");
  };

  const handleDeleteAll = async () => {
    setDeletingAll(true);
    try {
      // Delete from backend if authenticated
      if (isAuthenticated) {
        try {
          await deleteAllSessions();
        } catch (error) {
          // Continue to delete from browser storage even if backend fails
          console.warn("Failed to delete all sessions from backend:", error);
        }
      }

      // Clear all from browser storage
      clearAllStoredSessions();

      // Clear messages and sessions from store state
      useStore.getState().clearMessages();
      useStore.setState({ sessions: [] });

      // Create a new default session
      createNewSession();

      // Reload sessions list
      loadSessions();
      toast.success("All sessions deleted");
      setShowDeleteAllConfirm(false);
    } catch (error) {
      console.error("Error deleting all sessions:", error);
      toast.error(
        `Failed to delete all sessions: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setDeletingAll(false);
    }
  };

  const getSessionTitle = (sessionId: string): string => {
    const storedSessions = getStoredSessions();
    const session = storedSessions.find((s) => s.id === sessionId);
    if (session?.title) {
      return session.title;
    }
    return sessionId === "default" ? "Default" : sessionId;
  };

  return (
    <>
      {/* Mobile overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-[var(--modal-overlay)] z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        className={`
                fixed lg:static inset-y-0 left-0 z-50
                border-r border-[var(--sidebar-border)] bg-[var(--sidebar-bg)] 
                flex flex-col shrink-0
                transform transition-all duration-300 ease-in-out
                ${isOpen ? "translate-x-0" : "-translate-x-full"}
                ${!isOpen ? "lg:translate-x-0" : ""}
                ${isExpanded ? "lg:w-64" : "lg:w-16"}
                w-[280px] sm:w-72
                shadow-xl lg:shadow-none
                h-screen lg:h-auto
                overflow-hidden
            `}
      >
        {/* Header with close button for mobile */}
        <div
          className={`p-3 sm:p-4 border-b border-[var(--sidebar-border)] flex items-center ${
            isExpanded ? "justify-between" : "justify-center lg:justify-center"
          } shrink-0`}
        >
          <div
            className={`flex items-center ${
              isExpanded ? "gap-2" : "gap-0"
            } min-w-0`}
          >
            <MessageSquare className="w-5 h-5 sm:w-5 sm:h-5 text-[var(--green)] shrink-0" />
            <h2
              className={`text-base sm:text-lg font-semibold text-[var(--text-primary)] truncate transition-opacity duration-300 ${
                isExpanded
                  ? "opacity-100"
                  : "opacity-0 lg:w-0 lg:overflow-hidden"
              }`}
            >
              Chats
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors touch-manipulation shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>

        {/* New Chat Button and Delete All */}
        <div className="p-2 sm:p-3 border-b border-[var(--sidebar-border)] shrink-0 space-y-2">
          <button
            onClick={createNewSession}
            className={`w-full flex items-center ${
              isExpanded
                ? "justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3"
                : "justify-center lg:justify-center lg:px-2 lg:py-2.5"
            } bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--green)] font-medium text-sm shadow-md hover:shadow-lg active:scale-95 touch-manipulation`}
            aria-label="Create new session"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span
              className={`truncate transition-opacity duration-300 ${
                isExpanded
                  ? "opacity-100"
                  : "opacity-0 lg:w-0 lg:overflow-hidden"
              }`}
            >
              New chat
            </span>
          </button>
          {sessions.length > 0 && (
            <button
              onClick={() => setShowDeleteAllConfirm(true)}
              disabled={deletingAll}
              className={`w-full flex items-center ${
                isExpanded
                  ? "justify-center gap-2 px-3 py-2 sm:px-4 sm:py-2.5"
                  : "justify-center lg:justify-center lg:px-2 lg:py-2"
              } bg-red-600/20 hover:bg-red-600/30 text-red-400 hover:text-red-300 border border-red-600/30 hover:border-red-600/50 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500/50 font-medium text-sm disabled:opacity-50 disabled:cursor-not-allowed touch-manipulation`}
              aria-label="Delete all sessions"
            >
              <Trash2 className="w-4 h-4 shrink-0" aria-hidden="true" />
              <span
                className={`truncate transition-opacity duration-300 ${
                  isExpanded
                    ? "opacity-100"
                    : "opacity-0 lg:w-0 lg:overflow-hidden"
                }`}
              >
                Delete All
              </span>
            </button>
          )}
        </div>

        {/* Search Bar */}
        {sessions.length > 0 && isExpanded && (
          <div className="p-2 sm:p-3 border-b border-[var(--sidebar-border)] shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-[var(--text-secondary)]" />
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-sm text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)] focus:border-[var(--input-focus)]"
              />
            </div>
          </div>
        )}

        {/* Sessions List */}
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {sessionsLoading ? (
            // Enhanced skeleton loaders
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="animate-pulse p-3 rounded-lg bg-[var(--surface-elevated)] border border-[var(--border)]"
                  style={{
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-[var(--border)] rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-[var(--border)] rounded w-3/4" />
                      <div className="h-3 bg-[var(--border)] rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 sm:py-16 px-3 sm:px-4 animate-fade-in">
              <div className="relative mb-4 flex justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[var(--surface-elevated)] flex items-center justify-center border-2 border-dashed border-[var(--border)]">
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-[var(--text-secondary)]" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-[var(--text-primary)] mb-1">
                No conversations yet
              </h3>
              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-4">
                Start a new chat to begin your conversation
              </p>
              <button
                onClick={createNewSession}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
              >
                <Plus className="w-4 h-4" />
                Create First Chat
              </button>
            </div>
          ) : (
            (() => {
              // Filter sessions based on search query
              const filteredSessions = sessions.filter((session) => {
                if (!searchQuery.trim()) return true;
                const query = searchQuery.toLowerCase();
                const sessionTitle = getSessionTitle(
                  session.session_id
                ).toLowerCase();
                const sessionSummary = (session.summary || "").toLowerCase();
                return (
                  sessionTitle.includes(query) || sessionSummary.includes(query)
                );
              });

              if (filteredSessions.length === 0) {
                return (
                  <div className="text-center py-8 px-3">
                    <Search className="w-8 h-8 mx-auto mb-2 text-[var(--text-secondary)]" />
                    <p className="text-xs text-gray-500">
                      No conversations found
                    </p>
                  </div>
                );
              }

              return filteredSessions.map((session) => {
                const isEditing = editingSession === session.session_id;
                const sessionTitle =
                  session.title || getSessionTitle(session.session_id);

                return (
                  <div
                    key={session.session_id}
                    onClick={() => {
                      if (
                        !isEditing &&
                        session.session_id !== currentSessionId
                      ) {
                        setCurrentSession(session.session_id);
                        onClose?.();
                      }
                    }}
                    onKeyDown={(e) => {
                      if (
                        !isEditing &&
                        (e.key === "Enter" || e.key === " ") &&
                        session.session_id !== currentSessionId
                      ) {
                        e.preventDefault();
                        setCurrentSession(session.session_id);
                        onClose?.();
                      }
                    }}
                    tabIndex={0}
                    role="button"
                    aria-label={`Switch to session ${sessionTitle}`}
                    className={`group flex items-center ${
                      isExpanded
                        ? "justify-between"
                        : "justify-center lg:justify-center"
                    } p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[var(--green)] touch-manipulation ${
                      session.session_id === currentSessionId
                        ? "bg-[var(--surface-elevated)] text-[var(--text-primary)] shadow-md border-l-4 border-[var(--green)]"
                        : "hover:bg-[var(--surface-hover)] text-[var(--text-primary)] active:bg-[var(--surface-hover)] border-l-4 border-transparent hover:border-[var(--border)]"
                    }`}
                  >
                    <div
                      className={`flex items-center ${
                        isExpanded ? "gap-2 sm:gap-3 flex-1 min-w-0" : "gap-0"
                      } ${!isExpanded ? "lg:justify-center" : ""}`}
                    >
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 ${
                          session.session_id === currentSessionId
                            ? "text-[var(--green)]"
                            : "text-[var(--text-secondary)]"
                        }`}
                      />
                      <div
                        className={`flex-1 min-w-0 transition-opacity duration-300 ${
                          isExpanded
                            ? "opacity-100"
                            : "opacity-0 lg:w-0 lg:overflow-hidden"
                        }`}
                      >
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.stopPropagation();
                                  handleSaveEdit(session.session_id);
                                } else if (e.key === "Escape") {
                                  e.stopPropagation();
                                  setEditingSession(null);
                                  setEditTitle("");
                                }
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="flex-1 px-2 py-1 bg-[var(--input-bg)] border border-[var(--input-border)] rounded text-xs sm:text-sm text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--input-focus)]"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(session.session_id);
                              }}
                              className="p-1 hover:bg-[var(--surface-hover)] rounded"
                            >
                              <Save className="w-3 h-3 text-[var(--green)]" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-[var(--text-primary)] truncate">
                              {sessionTitle}
                            </p>
                            {/* Show summary if available */}
                            {session.summary && (
                              <p className="text-xs text-[var(--text-secondary)] truncate mt-0.5 line-clamp-2">
                                {session.summary}
                              </p>
                            )}
                            {/* Show message count */}
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                              {session.message_count || 0}{" "}
                              {session.message_count === 1
                                ? "message"
                                : "messages"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isEditing && isExpanded && (
                      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={(e) =>
                            handleEditSession(session.session_id, e)
                          }
                          className="p-1.5 hover:bg-[var(--surface-hover)] rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[var(--green)] touch-manipulation shrink-0"
                          aria-label={`Rename session ${sessionTitle}`}
                        >
                          <Edit2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            aria-hidden="true"
                          />
                        </button>
                        <button
                          onClick={(e) =>
                            handleDeleteSession(session.session_id, e)
                          }
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500 touch-manipulation shrink-0"
                          aria-label={`Delete session ${sessionTitle}`}
                        >
                          <Trash2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 hover:text-red-300"
                            aria-hidden="true"
                          />
                        </button>
                      </div>
                    )}
                  </div>
                );
              });
            })()
          )}
        </div>

        {/* Profile Section at Bottom */}
        <div className="mt-auto border-t border-[var(--sidebar-border)] shrink-0">
          {isAuthenticated ? (
            <div className={`p-2 sm:p-3 ${!isExpanded ? "lg:p-2" : ""}`}>
              <div
                className={`flex items-center ${
                  isExpanded
                    ? "gap-2 sm:gap-3 p-2 rounded-lg"
                    : "justify-center lg:justify-center lg:p-1.5"
                } hover:bg-[var(--surface-hover)] transition-all duration-200 group ${
                  !isExpanded ? "lg:rounded-full" : ""
                }`}
              >
                <div
                  className={`rounded-full bg-gradient-to-br from-[var(--green)] to-[var(--green-hover)] flex items-center justify-center text-white font-medium shrink-0 transition-all duration-200 ${
                    isExpanded
                      ? "w-8 h-8 text-sm"
                      : "w-8 h-8 lg:w-9 lg:h-9 text-base"
                  }`}
                >
                  {user?.name?.[0]?.toUpperCase() ||
                    user?.email?.[0]?.toUpperCase() ||
                    "U"}
                </div>
                {isExpanded && (
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-[var(--text-primary)] truncate">
                      {user?.name || user?.email || "User"}
                    </div>
                    {user?.email && user?.name && (
                      <div className="text-xs text-[var(--text-secondary)] truncate">
                        {user.email}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ) : (
            isExpanded && (
              <div className="p-2 sm:p-3 space-y-2">
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-auth", {
                        detail: { mode: "login" },
                      })
                    );
                  }}
                  className="w-full px-3 py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--primary)] rounded-lg transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent("open-auth", {
                        detail: { mode: "register" },
                      })
                    );
                  }}
                  className="w-full px-3 py-2 text-sm font-medium bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg transition-colors"
                >
                  Create account
                </button>
              </div>
            )
          )}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--modal-bg)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)]">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">
                  Delete Session
                </h3>
              </div>
              <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
                Are you sure you want to delete{" "}
                <span className="font-medium text-white">
                  {deletingSession === "default" ? "Default" : deletingSession}
                </span>
                ? This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={() => setDeletingSession(null)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--primary)] rounded-lg transition-colors touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirmDelete(deletingSession)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors touch-manipulation"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete All Confirmation Modal */}
      {showDeleteAllConfirm && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--modal-bg)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)]">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">
                  Delete All Sessions
                </h3>
              </div>
              <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
                Are you sure you want to delete all{" "}
                <span className="font-medium text-white">
                  {sessions.length} session{sessions.length !== 1 ? "s" : ""}
                </span>
                ? This will permanently remove all conversations and messages.
                This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={() => setShowDeleteAllConfirm(false)}
                  disabled={deletingAll}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--surface-elevated)] rounded-lg transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteAll}
                  disabled={deletingAll}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors touch-manipulation disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {deletingAll ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Delete All"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
