/**
 * Chat page - moved from app/page.tsx
 */
"use client";

import AuthModal from "@/components/AuthModal";
import ChatInput from "@/components/ChatInput";
import ChatWindow from "@/components/ChatWindow";
import HealthStatus from "@/components/HealthStatus";
import OnlineStatus from "@/components/OnlineStatus";
import RAGStatus from "@/components/rag/RAGStatus";
import SessionSidebar from "@/components/SessionSidebar";
import SettingsPanel from "@/components/SettingsPanel";
import UsageIndicator from "@/components/UsageIndicator";
import CommandPalette from "@/components/ui/CommandPalette";
import DashboardModal from "@/components/dashboard/DashboardModal";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import BlockedUserView from "@/components/BlockedUserView";
import NotificationsPopover from "@/components/admin/NotificationsPopover";
import { useStore } from "@/lib/store";
import { healthWebSocket } from "@/lib/websocket";
import { cn } from "@/lib/utils";
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  LayoutDashboard,
  FileText,
  Menu,
  Plus,
  Settings,
  Sparkles,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Toaster } from "react-hot-toast";
import { BackgroundBeams } from "@/components/ui/background-beams";

export default function ChatPage() {
  // Initialize sidebar state: always start with false to match SSR
  // Then sync with window width after mount to prevent hydration mismatch
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Set initial sidebar state based on window width after mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      setSidebarOpen(window.innerWidth >= 1024);
    }
  }, []);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">(
    "login"
  );
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [modeDropdownOpen, setModeDropdownOpen] = useState(false);
  const modeDropdownRef = useRef<HTMLDivElement>(null);
  const [dashboardOpen, setDashboardOpen] = useState(false);

  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const mode = useStore((state) => state.mode);
  const setMode = useStore((state) => state.setMode);
  const authLoading = useStore((state) => state.authLoading);
  const user = useStore((state) => state.user);
  const checkAuth = useStore((state) => state.checkAuth);
  // Theme is handled by ThemeToggle component

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Suppress console errors for permission errors during impersonation
  useEffect(() => {
    const impersonatedUserId = useStore.getState().impersonatedUserId;
    const isSuperAdmin = useStore.getState().isSuperadmin();
    // Only suppress errors if impersonating (superadmin can still access everything)
    const isImpersonating = !!impersonatedUserId;

    if (isImpersonating) {
      // Override console.error to suppress permission errors
      const originalError = console.error;
      console.error = (...args: any[]) => {
        const errorMessage = args[0]?.toString() || '';
        const isPermissionError =
          errorMessage.includes("Superadmin access required") ||
          (errorMessage.includes("Superadmin") && errorMessage.includes("required")) ||
          args.some((arg: any) =>
            arg?.message?.includes("Superadmin") ||
            arg?.detail?.includes("Superadmin") ||
            arg?.isPermissionError ||
            (typeof arg === 'object' && arg?.statusCode === 403)
          );

        // Only suppress permission errors during impersonation
        if (!isPermissionError) {
          originalError.apply(console, args);
        }
      };

      return () => {
        // Restore original console.error when component unmounts or impersonation ends
        console.error = originalError;
      };
    }
  }, [useStore.getState().impersonatedUserId, useStore.getState().user]);

  // Close mode dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        modeDropdownRef.current &&
        !modeDropdownRef.current.contains(event.target as Node)
      ) {
        setModeDropdownOpen(false);
      }
    };

    if (modeDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () =>
        document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [modeDropdownOpen]);

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
      // On desktop (>= 1024px), sidebar should be visible (can be collapsed but not hidden)
      // On mobile, keep current state (user can toggle)
      if (window.innerWidth >= 1024 && !sidebarOpen) {
        // If resizing to desktop and sidebar was closed, open it (but it will be collapsed)
        setSidebarOpen(true);
      }
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [sidebarOpen]);

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
        console.log("Ctrl+K pressed"); // Debugging
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

  // Load sessions and current session on mount and when dependencies change
  useEffect(() => {
    if (!authLoading) {
      // Load sessions first, then load the current session
      loadSessions().then(() => {
        // After sessions are loaded, load the current session messages
        loadSession(currentSessionId);
      });
    }
  }, [authLoading, loadSessions, loadSession, currentSessionId]);

  useEffect(() => {
    if (!authLoading) {
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
  }, [isAuthenticated, authLoading]);

  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        useStore.getState().saveCurrentSessionMessages();
      }, 2000);
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentSessionId]);

  // Show blocked user view if user is authenticated but blocked
  if (isAuthenticated && user && !user.is_active) {
    return <BlockedUserView />;
  }

  return (
    <div className="flex h-screen bg-neutral-950 overflow-hidden relative w-full">
      <BackgroundBeams className="opacity-40" />
      <OnlineStatus />
      <ImpersonationBanner />
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: "#18181b",
            color: "#fff",
            borderRadius: "12px",
            boxShadow: "0 10px 25px rgba(0, 0, 0, 0.1)",
            maxWidth: "90vw",
            fontSize: "14px",
            borderColor: "#27272a",
            borderWidth: "1px",
          },
        }}
      />

      <div className="relative z-10 flex h-full w-full">
        <SessionSidebar
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
          onToggle={() => setSidebarOpen((prev) => !prev)}
        />

        <RAGStatus />

        <div className="flex-1 flex flex-col min-w-0 w-full bg-transparent">
          <header className="border-b border-white/[0.1] bg-black/20 backdrop-blur-md px-2 sm:px-3 py-1.5 flex items-center justify-between shrink-0 sticky top-0 z-40">
            <div className="flex items-center gap-1.5 min-w-0 flex-1">
              {/* Back to Home Button */}
              <Link
                href="/"
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 active:bg-white/10 touch-manipulation backdrop-blur-sm flex items-center justify-center group"
                aria-label="Back to home"
                title="Back to home"
              >
                <ArrowLeft className="w-4 h-4 text-white group-hover:-translate-x-0.5 transition-transform" />
              </Link>

              <button
                onClick={() => setSidebarOpen((prev) => !prev)}
                className="p-1.5 bg-white/5 hover:bg-white/10 rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 active:bg-white/10 touch-manipulation backdrop-blur-sm flex items-center justify-center"
                aria-label={sidebarOpen ? "Close sidebar" : "Open sidebar"}
              >
                <Menu className="w-4 h-4 text-white" />
              </button>

              {/* Mode Dropdown */}
              <div className="relative" ref={modeDropdownRef}>
                <button
                  onClick={() => setModeDropdownOpen((prev) => !prev)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors group backdrop-blur-sm border border-white/5"
                >
                  <h1 className="text-sm font-bold truncate bg-gradient-to-r from-indigo-400 to-cyan-400 bg-clip-text text-transparent shadow-sm">
                    {mode === "rag" ? "RAG" : "DosiBridge Agent"}
                  </h1>
                  <ChevronDown
                    className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${modeDropdownOpen ? "rotate-180" : ""
                      }`}
                  />
                </button>

                {/* Dropdown Menu */}
                {modeDropdownOpen && (
                  <div className="absolute top-full left-0 mt-2 w-64 bg-zinc-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden ring-1 ring-black/5">
                    {/* Agent Mode Option */}
                    <button
                      onClick={() => {
                        setMode("agent");
                        setModeDropdownOpen(false);
                      }}
                      className={`w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors ${mode === "agent" ? "bg-white/5 border-l-2 border-indigo-500" : ""
                        }`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-md bg-indigo-500/20">
                        <Sparkles className="w-4 h-4 text-indigo-400" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white text-sm">
                            Agent Mode
                          </div>
                          {mode === "agent" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          AI agent with tool integration
                        </div>
                      </div>
                    </button>

                    {/* RAG Mode Option */}
                    <button
                      onClick={() => {
                        if (!isAuthenticated) {
                          setAuthModalMode("login");
                          setAuthModalOpen(true);
                          setModeDropdownOpen(false);
                          return;
                        }
                        setMode("rag");
                        setModeDropdownOpen(false);
                      }}
                      disabled={!isAuthenticated}
                      className={`w-full flex items-start gap-3 p-3 hover:bg-white/5 transition-colors ${mode === "rag" ? "bg-white/5 border-l-2 border-pink-500" : ""
                        } ${!isAuthenticated ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                    >
                      <div className="mt-0.5 p-1.5 rounded-md bg-pink-500/20">
                        <FileText className="w-4 h-4 text-pink-400" />
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="flex items-center justify-between">
                          <div className="font-semibold text-white text-sm">
                            RAG Mode
                          </div>
                          {mode === "rag" && (
                            <div className="w-1.5 h-1.5 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]"></div>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5">
                          Document analysis & retrieval
                        </div>
                        {!isAuthenticated && (
                          <div className="text-[10px] text-pink-400 mt-1 font-medium px-1.5 py-0.5 rounded bg-pink-400/10 w-fit">
                            Login Required
                          </div>
                        )}
                      </div>
                    </button>
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="hidden sm:block">
                <HealthStatus />
              </div>
              <div>
                <UsageIndicator />
              </div>
              {isAuthenticated && (
                <div className="hidden sm:block">
                  <NotificationsPopover />
                </div>
              )}
              <Link
                href="/monitoring"
                className="p-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 touch-manipulation flex items-center justify-center"
                aria-label="View monitoring"
                title="API Usage Monitoring"
              >
                <Activity
                  className="w-4 h-4 text-white"
                  aria-hidden="true"
                />
              </Link>
              {isAuthenticated && (
                <>
                  {/* Dashboard button - available to all authenticated users */}
                  <button
                    onClick={() => setDashboardOpen(true)}
                    className="p-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 touch-manipulation flex items-center justify-center"
                    aria-label="Open dashboard"
                    title="Dashboard"
                  >
                    <LayoutDashboard
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
                  </button>
                  {/* Admin/SuperAdmin Dashboard Link */}
                  {(user?.role === "superadmin" || user?.role === "admin") && (
                    <Link
                      href="/admin"
                      className="p-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 touch-manipulation flex items-center justify-center"
                      aria-label={user?.role === "superadmin" ? "Go to SuperAdmin dashboard" : "Go to Admin dashboard"}
                      title={user?.role === "superadmin" ? "SuperAdmin Dashboard" : "Admin Dashboard"}
                    >
                      <Shield
                        className={cn(
                          "w-4 h-4",
                          user?.role === "superadmin" ? "text-purple-400" : "text-blue-400"
                        )}
                        aria-hidden="true"
                      />
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setSettingsOpen(true);
                    }}
                    className="p-1.5 bg-white/5 hover:bg-white/10 backdrop-blur-sm rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 active:scale-95 touch-manipulation flex items-center justify-center"
                    aria-label="Open settings"
                    title="Settings (MCP & Model Configuration)"
                  >
                    <Settings
                      className="w-4 h-4 text-white"
                      aria-hidden="true"
                    />
                  </button>
                </>
              )}
            </div>
          </header>

          <ChatWindow />

          <ChatInput />
        </div>
      </div>

      <SettingsPanel />

      <DashboardModal
        isOpen={dashboardOpen}
        onClose={() => setDashboardOpen(false)}
      />

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
