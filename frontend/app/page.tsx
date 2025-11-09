/**
 * Main chat page
 */

'use client';

import ChatInput from '@/components/ChatInput';
import ChatWindow from '@/components/ChatWindow';
import HealthStatus from '@/components/HealthStatus';
import SessionSidebar from '@/components/SessionSidebar';
import SettingsPanel from '@/components/SettingsPanel';
import { useStore } from '@/lib/store';
import { Menu, Settings } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Toaster } from 'react-hot-toast';

export default function Home() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Close sidebar on mobile when clicking outside
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 1024) {
        setSidebarOpen(false); // Sidebar is always visible on desktop
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);
  const settingsOpen = useStore((state) => state.settingsOpen);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const loadSessions = useStore((state) => state.loadSessions);
  const loadSession = useStore((state) => state.loadSession);
  const currentSessionId = useStore((state) => state.currentSessionId);

  useEffect(() => {
    loadSessions();
    loadSession(currentSessionId);
  }, [loadSessions, loadSession, currentSessionId]);

  return (
    <div className="flex h-screen bg-[#343541] dark:bg-[#2d2d2f] overflow-hidden">
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            background: 'var(--background)',
            color: 'var(--foreground)',
            borderRadius: '12px',
            boxShadow: '0 10px 25px rgba(0, 0, 0, 0.1)',
          },
        }}
      />

      {/* Session Sidebar */}
      <SessionSidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <header className="border-b border-gray-700 bg-[#343541] dark:bg-[#2d2d2f] px-3 sm:px-4 md:px-6 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            {/* Mobile menu button */}
            <button
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden p-2 hover:bg-[#40414f] rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-[#10a37f]"
              aria-label="Open sidebar"
            >
              <Menu className="w-5 h-5 text-gray-300" />
            </button>

            <h1 className="text-lg sm:text-xl font-semibold text-gray-200 truncate">
              DOSI-AI-agent
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            <div className="hidden sm:block">
              <HealthStatus />
            </div>
            <button
              onClick={() => setSettingsOpen(true)}
              className="p-2 hover:bg-[#40414f] rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#10a37f] active:scale-95"
              aria-label="Open settings"
            >
              <Settings className="w-5 h-5 text-gray-300" aria-hidden="true" />
            </button>
          </div>
        </header>

        {/* Chat Window */}
        <ChatWindow />

        {/* Chat Input */}
        <ChatInput />
      </div>

      {/* Settings Panel */}
      <SettingsPanel isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
