"use client";

import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  IconSettings,
  IconBell,
  IconDatabase,
  IconUser,
  IconShield,
  IconInfoCircle,
} from "@tabler/icons-react";
import { useStore } from "@/lib/store";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { updateProfile, changePassword, type UpdateProfileRequest, type ChangePasswordRequest } from "@/lib/api/auth";
import { deleteAllSessions } from "@/lib/api/sessions";
import { clearAllStoredSessions } from "@/lib/sessionStorage";
import toast from "react-hot-toast";

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type TabId = "general" | "notification" | "data" | "account" | "security" | "help" | "about";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "notification", label: "Notification", icon: IconBell },
  { id: "data", label: "Data Control", icon: IconDatabase },
  { id: "account", label: "Account", icon: IconUser },
  { id: "security", label: "Security", icon: IconShield },
  { id: "help", label: "Help & Support", icon: IconInfoCircle },
  { id: "about", label: "About", icon: IconInfoCircle },
];

export default function ProfileSettingsDialog({
  isOpen,
  onClose,
  initialTab = "general",
}: ProfileSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab as TabId);
  const [mounted, setMounted] = useState(false);
  const user = useStore((state) => state.user);
  const checkAuth = useStore((state) => state.checkAuth);
  const setCurrentSession = useStore((state) => state.setCurrentSession);
  const createNewSession = useStore((state) => state.createNewSession);

  // General settings state
  const [compactMode, setCompactMode] = useState(false);
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [defaultChatMode, setDefaultChatMode] = useState<"agent" | "rag">("agent");
  const [autoSaveSessions, setAutoSaveSessions] = useState(true);

  // Notification settings state
  const [systemNotifications, setSystemNotifications] = useState(true);
  const [errorNotifications, setErrorNotifications] = useState(true);
  const [successMessages, setSuccessMessages] = useState(true);

  // Account settings state
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [savingProfile, setSavingProfile] = useState(false);

  // Security settings state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [showPasswordFields, setShowPasswordFields] = useState(false);

  // Data control state
  const [exportingData, setExportingData] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab as TabId);
    }
  }, [isOpen, initialTab]);

  useEffect(() => {
    if (user) {
      setName(user.name || "");
      setEmail(user.email || "");
    }
  }, [user]);

  useEffect(() => {
    const handleTabChange = (event: CustomEvent) => {
      if (event.detail && TABS.find(t => t.id === event.detail)) {
        setActiveTab(event.detail as TabId);
      }
    };

    if (typeof window !== "undefined") {
      window.addEventListener('profileSettingsTab', handleTabChange as EventListener);
      return () => {
        window.removeEventListener('profileSettingsTab', handleTabChange as EventListener);
      };
    }
  }, []);

  const handleSaveProfile = async () => {
    if (!user) return;
    
    const updates: UpdateProfileRequest = {};
    if (name.trim() !== user.name) {
      updates.name = name.trim();
    }
    if (email.trim() !== user.email) {
      updates.email = email.trim();
    }

    if (!updates.name && !updates.email) {
      toast.error("No changes to save");
      return;
    }

    setSavingProfile(true);
    try {
      await updateProfile(updates);
      toast.success("Profile updated successfully");
      await checkAuth(); // Refresh user data
    } catch (error: any) {
      toast.error(error.message || "Failed to update profile");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast.error("Please fill in all password fields");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    setChangingPassword(true);
    try {
      const data: ChangePasswordRequest = {
        current_password: currentPassword,
        new_password: newPassword,
      };
      await changePassword(data);
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setShowPasswordFields(false);
    } catch (error: any) {
      toast.error(error.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const handleExportData = async () => {
    setExportingData(true);
    try {
      // Get all sessions and messages from store
      const sessions = useStore.getState().sessions;
      const currentSessionId = useStore.getState().currentSessionId;
      const messages = useStore.getState().messages;

      const exportData = {
        user: user,
        sessions: sessions,
        currentSession: {
          id: currentSessionId,
          messages: messages,
        },
        exportDate: new Date().toISOString(),
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dosibridge-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Data exported successfully");
    } catch (error: any) {
      toast.error("Failed to export data");
    } finally {
      setExportingData(false);
    }
  };

  const handleClearChatHistory = async () => {
    if (!confirm("Are you sure you want to clear all chat history? This action cannot be undone.")) {
      return;
    }

    setClearingHistory(true);
    try {
      // Clear backend sessions if authenticated
      try {
        await deleteAllSessions();
      } catch (error) {
        // Ignore errors - might not be authenticated
      }
      
      // Clear local storage sessions
      clearAllStoredSessions();
      
      // Create a new session
      await createNewSession();
      
      toast.success("Chat history cleared successfully");
    } catch (error: any) {
      toast.error("Failed to clear chat history");
    } finally {
      setClearingHistory(false);
    }
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">General Settings</h3>
              <p className="text-sm text-neutral-400 mb-6">Manage your application preferences and display options.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Display Preferences</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Compact Mode</p>
                        <p className="text-xs text-neutral-400">Use a more compact interface layout</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={compactMode}
                          onChange={(e) => setCompactMode(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Show Timestamps</p>
                        <p className="text-xs text-neutral-400">Display message timestamps in chat</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={showTimestamps}
                          onChange={(e) => setShowTimestamps(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>
                </div>

                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Chat Preferences</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Default Chat Mode
                      </label>
                      <select 
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        value={defaultChatMode}
                        onChange={(e) => setDefaultChatMode(e.target.value as "agent" | "rag")}
                      >
                        <option value="agent">Agent Mode</option>
                        <option value="rag">RAG Mode</option>
                      </select>
                      <p className="text-xs text-neutral-400 mt-1">Choose your default mode when starting a new chat</p>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Auto-save Sessions</p>
                        <p className="text-xs text-neutral-400">Automatically save chat sessions</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={autoSaveSessions}
                          onChange={(e) => setAutoSaveSessions(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "notification":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Notification Settings</h3>
              <p className="text-sm text-neutral-400 mb-6">Configure how and when you receive notifications.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Notification Types</h4>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">System Notifications</p>
                        <p className="text-xs text-neutral-400">Receive system alerts and updates</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={systemNotifications}
                          onChange={(e) => setSystemNotifications(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Error Notifications</p>
                        <p className="text-xs text-neutral-400">Get notified about errors and issues</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={errorNotifications}
                          onChange={(e) => setErrorNotifications(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-white">Success Messages</p>
                        <p className="text-xs text-neutral-400">Show success notifications</p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          className="sr-only peer" 
                          checked={successMessages}
                          onChange={(e) => setSuccessMessages(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "data":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Data Control</h3>
              <p className="text-sm text-neutral-400 mb-6">Manage your data, privacy, and account information.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Data Management</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-neutral-300 mb-2">
                        Export all your data including conversations, documents, and settings.
                      </p>
                      <button 
                        onClick={handleExportData}
                        disabled={exportingData}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 rounded-lg text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {exportingData ? "Exporting..." : "Export All Data"}
                      </button>
                    </div>
                    <div className="border-t border-neutral-700 pt-3">
                      <p className="text-sm text-neutral-300 mb-2">
                        Clear all your chat sessions and conversation history.
                      </p>
                      <button 
                        onClick={handleClearChatHistory}
                        disabled={clearingHistory}
                        className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {clearingHistory ? "Clearing..." : "Clear Chat History"}
                      </button>
                    </div>
                  </div>
                </div>
                
                <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-yellow-400 mb-3">Account Management</h4>
                  <div className="space-y-3">
                    <p className="text-sm text-neutral-300 mb-2">
                      Account deletion is not available for security reasons. Please contact your administrator if you need to delete your account.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "account":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Account Information</h3>
              <p className="text-sm text-neutral-400 mb-6">View and manage your account details.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Profile Details</h4>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Display Name
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-neutral-500"
                        placeholder="Enter your name"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Email Address
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 placeholder:text-neutral-500"
                        placeholder="your.email@example.com"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-neutral-300 mb-2">
                        Account Role
                      </label>
                      <input
                        type="text"
                        value={
                          user?.role === "superadmin"
                            ? "Super Admin"
                            : user?.role
                            ? user.role.charAt(0).toUpperCase() + user.role.slice(1)
                            : "User"
                        }
                        disabled
                        className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 cursor-not-allowed"
                      />
                    </div>
                    <div className="pt-2">
                      <button 
                        onClick={handleSaveProfile}
                        disabled={savingProfile}
                        className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {savingProfile ? "Saving..." : "Save Changes"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Security Settings</h3>
              <p className="text-sm text-neutral-400 mb-6">Manage your account security and authentication.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Password & Authentication</h4>
                  <div className="space-y-4">
                    {!showPasswordFields ? (
                      <div>
                        <p className="text-sm text-neutral-300 mb-3">
                          Change your account password to keep your account secure.
                        </p>
                        <button 
                          onClick={() => setShowPasswordFields(true)}
                          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 rounded-lg text-sm font-medium text-white transition-colors"
                        >
                          Change Password
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Current Password
                          </label>
                          <input
                            type="password"
                            value={currentPassword}
                            onChange={(e) => setCurrentPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter current password"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-300 mb-2">
                            New Password
                          </label>
                          <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Enter new password (min. 8 characters)"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-neutral-300 mb-2">
                            Confirm New Password
                          </label>
                          <input
                            type="password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Confirm new password"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button 
                            onClick={handleChangePassword}
                            disabled={changingPassword}
                            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 border border-indigo-500/30 rounded-lg text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          >
                            {changingPassword ? "Changing..." : "Update Password"}
                          </button>
                          <button 
                            onClick={() => {
                              setShowPasswordFields(false);
                              setCurrentPassword("");
                              setNewPassword("");
                              setConfirmPassword("");
                            }}
                            className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm font-medium text-white transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Active Sessions</h4>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 bg-neutral-900/50 rounded-lg">
                      <div>
                        <p className="text-sm font-medium text-white">Current Session</p>
                        <p className="text-xs text-neutral-400">This device • Active now</p>
                      </div>
                      <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "help":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">Help & Support</h3>
              <p className="text-sm text-neutral-400 mb-6">Get help and learn how to use DosiBridge Agent.</p>
              
              <div className="space-y-4">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Documentation</h4>
                  <div className="space-y-2">
                    <a
                      href="/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white transition-colors"
                    >
                      <div className="font-medium">View Documentation</div>
                      <div className="text-xs text-neutral-400 mt-1">Complete guide and API reference</div>
                    </a>
                    <a
                      href="https://github.com/dosibridge/agent-tool"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block px-4 py-3 bg-neutral-900/50 hover:bg-neutral-900 border border-neutral-700 rounded-lg text-sm text-white transition-colors"
                    >
                      <div className="font-medium">GitHub Repository</div>
                      <div className="text-xs text-neutral-400 mt-1">Source code and issues</div>
                    </a>
                  </div>
                </div>
                
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-3">Quick Links</h4>
                  <div className="space-y-2">
                    <div className="px-4 py-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                      <div className="text-sm font-medium text-white mb-1">Getting Started</div>
                      <div className="text-xs text-neutral-400">Learn how to use Agent and RAG modes</div>
                    </div>
                    <div className="px-4 py-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                      <div className="text-sm font-medium text-white mb-1">MCP Servers</div>
                      <div className="text-xs text-neutral-400">Configure and connect MCP tools</div>
                    </div>
                    <div className="px-4 py-3 bg-neutral-900/50 border border-neutral-700 rounded-lg">
                      <div className="text-sm font-medium text-white mb-1">Document Management</div>
                      <div className="text-xs text-neutral-400">Upload and manage documents for RAG</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case "about":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-xl font-semibold text-white mb-2">About</h3>
              <p className="text-sm text-neutral-400 mb-6">Information about DosiBridge Agent and your account.</p>
              
              <div className="space-y-6">
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Application</h4>
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm font-medium text-white mb-1">DosiBridge Agent</p>
                      <p className="text-xs text-neutral-400">Version 1.0.0</p>
                    </div>
                    <div className="border-t border-neutral-700 pt-3">
                      <p className="text-sm font-medium text-white mb-1">User ID</p>
                      <p className="text-xs text-neutral-400 font-mono">
                        {user?.id || "N/A"}
                      </p>
                    </div>
                    <div className="border-t border-neutral-700 pt-3">
                      <p className="text-sm font-medium text-white mb-1">Account Role</p>
                      <p className="text-xs text-neutral-400 capitalize">
                        {user?.role === "superadmin" ? "Super Admin" : user?.role || "User"}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="bg-neutral-800/50 border border-neutral-700 rounded-xl p-4">
                  <h4 className="text-sm font-semibold text-white mb-4">Resources</h4>
                  <div className="space-y-2">
                    <a
                      href="/docs"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      Documentation →
                    </a>
                    <a
                      href="https://github.com/dosibridge/agent-tool"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                    >
                      GitHub Repository →
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  // Don't render if not mounted, window is undefined, or dialog is closed
  if (!mounted || typeof window === "undefined" || !isOpen) return null;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 pointer-events-none"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-4xl min-h-[500px] max-h-[85vh] flex flex-col overflow-hidden relative pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between p-6 border-b border-neutral-800">
                <h2 className="text-2xl font-bold text-white">Profile Settings</h2>
                <button
                  onClick={onClose}
                  className="p-2 hover:bg-neutral-800 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-neutral-400" />
                </button>
              </div>

              {/* Content */}
              <div className="flex flex-1 overflow-hidden">
                {/* Sidebar Tabs */}
                <div className="w-64 border-r border-neutral-800 p-4 overflow-y-auto">
                  <nav className="space-y-1">
                    {TABS.map((tab) => {
                      const Icon = tab.icon;
                      return (
                        <button
                          key={tab.id}
                          onClick={() => setActiveTab(tab.id)}
                          className={cn(
                            "w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm transition-colors",
                            activeTab === tab.id
                              ? "bg-indigo-500/20 text-indigo-400 border border-indigo-500/30"
                              : "text-neutral-400 hover:bg-neutral-800 hover:text-white"
                          )}
                        >
                          <Icon className="w-5 h-5" />
                          <span>{tab.label}</span>
                        </button>
                      );
                    })}
                  </nav>
                </div>

                {/* Tab Content */}
                <div className="flex-1 p-6 overflow-y-auto min-h-0">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  );
}
