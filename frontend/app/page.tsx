/**
 * Main chat page
 */

"use client";

import AuthModal from "@/components/AuthModal";
import ChatInput from "@/components/ChatInput";
import ChatWindow from "@/components/ChatWindow";
import HealthStatus from "@/components/HealthStatus";
import SessionSidebar from "@/components/SessionSidebar";
import SettingsPanel from "@/components/SettingsPanel";
import { useStore } from "@/lib/store";
import { LogOut, Menu, Settings, User } from "lucide-react";
import { useEffect, useState } from "react";
import { Toaster, toast } from "react-hot-toast";

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<"login" | "register">(
    "login"
  );

  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const user = useStore((state) => state.user);
  const checkAuth = useStore((state) => state.checkAuth);
  const handleLogout = useStore((state) => state.handleLogout);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false); // Sidebar is always visible on desktop
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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      // Ctrl/Cmd + K: Toggle sidebar (or command palette in future)
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setSidebarOpen((prev) => !prev);
      }
      // Ctrl/Cmd + N: New session
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        useStore.getState().createNewSession();
        toast.success("New session created");
      }
      // Escape: Close modals/sidebar
      if (e.key === "Escape") {
        if (settingsOpen) {
          setSettingsOpen(false);
        }
        if (authModalOpen) {
          setAuthModalOpen(false);
        }
        if (sidebarOpen && window.innerWidth < 1024) {
          setSidebarOpen(false);
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => window.removeEventListener("keydown", handleKeyPress);
  }, [settingsOpen, authModalOpen, sidebarOpen, setSettingsOpen]);

  useEffect(() => {
    // Load sessions and current session on mount
    loadSessions();
    loadSession(currentSessionId);
  }, [loadSessions, loadSession, currentSessionId]);

  // Save messages to browser storage when they change (debounced)
  useEffect(() => {
    if (messages.length > 0) {
      const timeoutId = setTimeout(() => {
        useStore.getState().saveCurrentSessionMessages();
      }, 2000); // Save 2 seconds after last change
      return () => clearTimeout(timeoutId);
    }
  }, [messages, currentSessionId]);

  return (
    <div className="flex h-screen bg-[#343541] dark:bg-[#2d2d2f] overflow-hidden">
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

      {/* Session Sidebar */}
      <SessionSidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 w-full">
        {/* Header */}
        <header className="border-b border-gray-700 bg-[#343541] dark:bg-[#2d2d2f] px-2 sm:px-4 md:px-6 py-2 sm:py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 sm:p-2.5 hover:bg-[#40414f] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#10a37f] active:bg-[#40414f] touch-manipulation"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 sm:w-6 sm:h-6 text-gray-300" />
            </button>

            <h1 className="text-base sm:text-lg md:text-xl font-semibold text-gray-200 truncate">
              DOSI-AI-agent
            </h1>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            {isAuthenticated ? (
              <>
                <div className="hidden sm:flex items-center gap-2 text-sm text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="truncate max-w-[150px]">
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
                    toast.success("Logged out successfully");
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

        {/* Chat Window */}
        <ChatWindow />

        {/* Chat Input */}
        <ChatInput />
      </div>

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
      />

      {/* Auth Modal */}
      <AuthModal
        isOpen={authModalOpen}
        onClose={() => setAuthModalOpen(false)}
        initialMode={authModalMode}
      />
    </div>
  );
}
