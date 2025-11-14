/**
 * Session sidebar component
 */

"use client";

import { deleteSession } from "@/lib/api";
import { deleteStoredSession, getStoredSessions } from "@/lib/sessionStorage";
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
  const [editingSession, setEditingSession] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

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
          console.log(`✓ Deleted session ${sessionId} from database`);
        } catch (error) {
          console.warn(
            "Failed to delete from backend, deleting from browser storage:",
            error
          );
          // Continue to delete from browser storage even if backend fails
        }
      }

      // Always delete from browser storage (temporary storage)
      // This ensures cleanup even if not authenticated
      deleteStoredSession(sessionId);
      console.log(`✓ Deleted session ${sessionId} from browser storage`);

      // If deleted session was current, create a new one
      if (sessionId === currentSessionId) {
        createNewSession();
      }

      // Reload sessions list
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
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={onClose}
          aria-hidden="true"
        />
      )}

      {/* Sidebar */}
      <div
        className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-[280px] sm:w-72 lg:w-64 border-r border-gray-700 bg-[#202123] 
                flex flex-col shrink-0
                transform transition-transform duration-300 ease-in-out
                ${
                  isOpen
                    ? "translate-x-0"
                    : "-translate-x-full lg:translate-x-0"
                }
                shadow-xl lg:shadow-none
                h-screen lg:h-auto
            `}
      >
        {/* Header with close button for mobile */}
        <div className="p-3 sm:p-4 border-b border-gray-700 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <MessageSquare className="w-5 h-5 sm:w-5 sm:h-5 text-[#10a37f] shrink-0" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-200 truncate">
              Chats
            </h2>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="lg:hidden p-1.5 sm:p-2 hover:bg-[#343541] rounded-lg transition-colors touch-manipulation shrink-0"
              aria-label="Close sidebar"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          )}
        </div>

        {/* New Chat Button */}
        <div className="p-2 sm:p-3 border-b border-gray-700 shrink-0">
          <button
            onClick={createNewSession}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#10a37f] font-medium text-sm shadow-md hover:shadow-lg active:scale-95 touch-manipulation"
            aria-label="Create new session"
          >
            <Plus className="w-4 h-4 shrink-0" aria-hidden="true" />
            <span className="truncate">New chat</span>
          </button>
        </div>

        {/* Search Bar */}
        {sessions.length > 0 && (
          <div className="p-2 sm:p-3 border-b border-gray-700 shrink-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-[#343541] border border-gray-600 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
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
                  className="animate-pulse p-3 rounded-lg bg-[#343541] border border-gray-700"
                  style={{
                    animationDelay: `${i * 100}ms`,
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-4 h-4 bg-gray-700 rounded shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-700 rounded w-3/4" />
                      <div className="h-3 bg-gray-800 rounded w-1/2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-12 sm:py-16 px-3 sm:px-4 animate-fade-in">
              <div className="relative mb-4 flex justify-center">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-[#343541] flex items-center justify-center border-2 border-dashed border-gray-600">
                  <MessageSquare className="w-8 h-8 sm:w-10 sm:h-10 text-gray-600" />
                </div>
              </div>
              <h3 className="text-sm sm:text-base font-semibold text-gray-300 mb-1">
                No conversations yet
              </h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-4">
                Start a new chat to begin your conversation
              </p>
              <button
                onClick={createNewSession}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg text-sm font-medium transition-all hover:scale-105 active:scale-95"
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
                    <Search className="w-8 h-8 mx-auto mb-2 text-gray-600" />
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
                    className={`group flex items-center justify-between p-2.5 sm:p-3 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#10a37f] touch-manipulation ${
                      session.session_id === currentSessionId
                        ? "bg-[#343541] text-white shadow-md border-l-4 border-[#10a37f]"
                        : "hover:bg-[#2d2d2f] text-gray-300 active:bg-[#2d2d2f] border-l-4 border-transparent hover:border-gray-600"
                    }`}
                  >
                    <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
                      <MessageSquare
                        className={`w-4 h-4 shrink-0 ${
                          session.session_id === currentSessionId
                            ? "text-[#10a37f]"
                            : "text-gray-500"
                        }`}
                      />
                      <div className="flex-1 min-w-0">
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
                              className="flex-1 px-2 py-1 bg-[#2d2d2f] border border-gray-600 rounded text-xs sm:text-sm text-white focus:outline-none focus:ring-2 focus:ring-[#10a37f]"
                              autoFocus
                            />
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(session.session_id);
                              }}
                              className="p-1 hover:bg-[#40414f] rounded"
                            >
                              <Save className="w-3 h-3 text-[#10a37f]" />
                            </button>
                          </div>
                        ) : (
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-200 truncate">
                              {sessionTitle}
                            </p>
                            {/* Show summary if available */}
                            {session.summary && (
                              <p className="text-xs text-gray-500 truncate mt-0.5 line-clamp-2">
                                {session.summary}
                              </p>
                            )}
                            {/* Show message count */}
                            <p className="text-xs text-gray-600 mt-0.5">
                              {session.message_count || 0}{" "}
                              {session.message_count === 1
                                ? "message"
                                : "messages"}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                    {!isEditing && (
                      <div className="flex items-center gap-1 ml-2 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity">
                        <button
                          onClick={(e) =>
                            handleEditSession(session.session_id, e)
                          }
                          className="p-1.5 hover:bg-[#40414f] rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#10a37f] touch-manipulation shrink-0"
                          aria-label={`Rename session ${sessionTitle}`}
                        >
                          <Edit2
                            className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 hover:text-gray-300"
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

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-gray-700 shrink-0">
          <div className="text-xs text-gray-500 mb-1">Current session</div>
          <div className="text-xs sm:text-sm font-medium text-gray-300 truncate">
            {currentSessionId === "default" ? "Default" : currentSessionId}
          </div>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingSession && (
        <div className="fixed inset-0 bg-black/60 z-60 flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#343541] rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
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
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#40414f] rounded-lg transition-colors touch-manipulation"
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
    </>
  );
}
