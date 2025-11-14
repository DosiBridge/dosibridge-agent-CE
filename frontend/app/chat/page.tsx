/**
 * Chat page - moved from app/page.tsx
 */
"use client";

import AuthModal from "@/components/AuthModal";
import ChatInput from "@/components/ChatInput";
import ChatWindow from "@/components/ChatWindow";
import HealthStatus from "@/components/HealthStatus";
import OnlineStatus from "@/components/OnlineStatus";
import RAGSettings from "@/components/RAGSettings";
import SessionSidebar from "@/components/SessionSidebar";
import SettingsPanel from "@/components/SettingsPanel";
import CommandPalette from "@/components/ui/CommandPalette";
import { useStore } from "@/lib/store";
import { healthWebSocket } from "@/lib/websocket";
import { LogOut, Menu, Plus, Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster } from "react-hot-toast";

export default function ChatPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">(
    "login"
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);

  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const user = useStore((state) => state.user);
  const checkAuth = useStore((state) => state.checkAuth);
  const handleLogout = useStore((state) => state.handleLogout);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Initialize WebSocket connection for health monitoring
  useEffect(() => {
    healthWebSocket.disconnect(true);

    if (isAuthenticated) {
      const timer = setTimeout(() => {
        healthWebSocket.connect();
      }, 100);

      return () => {
        clearTimeout(timer);
        healthWebSocket.disconnect(false);
      };
    } else {
      return () => {
        healthWebSocket.disconnect(false);
      };
    }
  }, [isAuthenticated]);

  useEffect(() => {
    const handleOpenAuth = (e: CustomEvent) => {
      if (e.detail?.mode === "register") {
        setAuthModalMode("register");
      } else {
        setAuthModalMode("login");
      }
      setAuthModalOpen(true);
    };

    window.addEventListener("open-auth" as any, handleOpenAuth);
    return () => window.removeEventListener("open-auth" as any, handleOpenAuth);
  }, []);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const loadSessions = useStore((state) => state.loadSessions);
  const loadSession = useStore((state) => state.loadSession);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const messages = useStore((state) => state.messages);
  const settingsOpen = useStore((state) => state.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const ragSettingsOpen = useStore((state) => state.ragSettingsOpen);
  const setRagSettingsOpen = useStore((state) => state.setRagSettingsOpen);
  const useReact = useStore((state) => state.useReact);
  const setUseReact = useStore((state) => state.setUseReact);
  const selectedCollectionId = useStore((state) => state.selectedCollectionId);
  const setSelectedCollectionId = useStore(
    (state) => state.setSelectedCollectionId
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setCommandPaletteOpen((prev) => !prev);
      }
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        useStore.getState().createNewSession();
      }
      if (e.key === "Escape") {
        if (commandPaletteOpen) {
          setCommandPaletteOpen(false);
        } else if (settingsOpen) {
          setSettingsOpen(false);
        } else if (authModalOpen) {
          setAuthModalOpen(false);
        } else if (sidebarOpen && window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [
    settingsOpen,
    authModalOpen,
    sidebarOpen,
    commandPaletteOpen,
    setSettingsOpen,
  ]);

  useEffect(() => {
    loadSessions();
    loadSession(currentSessionId);
  }, [loadSessions, loadSession, currentSessionId]);

  useEffect(() => {
    if (!authLoading) {
      // Always load sessions (works for both authenticated and unauthenticated users)
      // Agent mode works without login, so load browser sessions
      loadSessions();

      if (isAuthenticated) {
        // Load MCP servers only when authenticated
        const loadMCPServers = useStore.getState().loadMCPServers;
        loadMCPServers();
      } else {
        // Not authenticated - ensure we're in agent mode (agent works without login)
        const currentMode = useStore.getState().mode;
        if (currentMode === "rag") {
          useStore.getState().setMode("agent");
        }
      }
    }
  }, [isAuthenticated, authLoading, loadSessions]);

  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        useStore.getState().saveCurrentSessionMessages();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentSessionId]);

  return (
    <div className="flex h-screen bg-[#343541] dark:bg-[#2d2d2f] overflow-hidden">
      <OnlineStatus />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "var(--background)",
            color: "var(--foreground)",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            maxWidth: "90vw",
            fontSize: "14px",
          },
        }}
      />

      <SessionSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 w-full">
        <header className="border-b border-gray-700 bg-[#343541] dark:bg-[#2d2d2f] px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 sm:p-2.5 hover:bg-[#40414f] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#10a37f] active:bg-[#40414f] touch-manipulation"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
            </button>

            <h1 className="text-base sm:text-lg md:text-xl font-semibold truncate bg-gradient-to-r from-[#10a37f] to-[#0d8f6e] bg-clip-text text-transparent">
              DosiBridge Agent
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            {isAuthenticated ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400 px-3 py-1.5 rounded-lg hover:bg-[#40414f] transition-colors">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-[#10a37f] to-[#0d8f6e] flex items-center justify-center text-white text-xs font-medium">
                    {user?.name?.[0]?.toUpperCase() ||
                      user?.email?.[0]?.toUpperCase() ||
                      "U"}
                  </div>
                  <span className="truncate max-w-[150px] font-medium">
                    {user?.name || user?.email}
                  </span>
                </div>
                <div className="hidden sm:block">
                  <HealthStatus />
                </div>
                <button
                  onClick={() => {
                    if (!isAuthenticated) {
                      setAuthModalMode("login");
                      setAuthModalOpen(true);
                    } else {
                      setSettingsOpen(true);
                    }
                  }}
                  className="p-2 sm:p-2.5 hover:bg-[#40414f] rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#10a37f] active:scale-95 touch-manipulation"
                  aria-label="Open settings"
                  title={
                    isAuthenticated
                      ? "Settings (MCP & Model Configuration)"
                      : "Log in to access settings"
                  }
                >
                  <Settings
                    className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300"
                    aria-hidden="true"
                  />
                </button>
                <button
                  onClick={async () => {
                    await handleLogout();
                  }}
                  className="p-2 sm:p-2.5 hover:bg-[#40414f] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#10a37f]"
                  aria-label="Logout"
                  title="Logout"
                >
                  <LogOut className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
                </button>
              </>
            ) : (
              <>
                <div className="hidden sm:block">
                  <HealthStatus />
                </div>
                <button
                  onClick={() => {
                    setAuthModalMode("login");
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    setAuthModalMode("register");
                    setAuthModalOpen(true);
                  }}
                  className="px-4 py-2 text-sm font-medium bg-white text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Create account
                </button>
              </>
            )}
          </div>
        </header>

        <ChatWindow />

        <ChatInput />
      </div>

      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {isAuthenticated && (
        <RAGSettings
          isOpen={ragSettingsOpen}
          onClose={() => setRagSettingsOpen(false)}
          selectedCollectionId={selectedCollectionId}
          onCollectionSelect={setSelectedCollectionId}
          useReact={useReact}
          onUseReactChange={setUseReact}
        />
      )}

      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />

      <CommandPalette
        isOpen={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        items={[
          {
            id: "new-session",
            label: "New Chat",
            description: "Create a new conversation",
            icon: <Plus className="w-4 h-4" />,
            action: () => {
              useStore.getState().createNewSession();
            },
            category: "Chat",
          },
          {
            id: "toggle-sidebar",
            label: "Toggle Sidebar",
            description: "Show or hide the sidebar",
            icon: <Menu className="w-4 h-4" />,
            action: () => {
              setSidebarOpen((prev) => !prev);
            },
            category: "Navigation",
          },
          {
            id: "open-settings",
            label: "Open Settings",
            description: "Configure MCP servers and LLM",
            icon: <Settings className="w-4 h-4" />,
            action: () => {
              if (isAuthenticated) {
                setSettingsOpen(true);
              } else {
                setAuthModalMode("login");
                setAuthModalOpen(true);
              }
            },
            category: "Settings",
          },
        ]}
      />
    </div>
  );
}
