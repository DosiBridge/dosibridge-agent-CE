"use client";

import React, { useState } from "react";
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

interface ProfileSettingsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: string;
}

type TabId = "general" | "notification" | "data" | "account" | "security" | "about";

const TABS: { id: TabId; label: string; icon: React.ElementType }[] = [
  { id: "general", label: "General", icon: IconSettings },
  { id: "notification", label: "Notification", icon: IconBell },
  { id: "data", label: "Data Control", icon: IconDatabase },
  { id: "account", label: "Account", icon: IconUser },
  { id: "security", label: "Security", icon: IconShield },
  { id: "about", label: "About", icon: IconInfoCircle },
];

export default function ProfileSettingsDialog({
  isOpen,
  onClose,
  initialTab = "general",
}: ProfileSettingsDialogProps) {
  const [activeTab, setActiveTab] = useState<TabId>(initialTab as TabId);
  const user = useStore((state) => state.user);

  if (!isOpen) return null;

  const renderTabContent = () => {
    switch (activeTab) {
      case "general":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">General Settings</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Language
                  </label>
                  <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>English</option>
                    <option>Spanish</option>
                    <option>French</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Theme
                  </label>
                  <select className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option>Dark</option>
                    <option>Light</option>
                    <option>System</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        );
      case "notification":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Notification Settings</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Email Notifications</p>
                    <p className="text-xs text-neutral-400">Receive email updates</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" defaultChecked />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-white">Push Notifications</p>
                    <p className="text-xs text-neutral-400">Browser push notifications</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      case "data":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Data Control</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-300 mb-2">
                    Manage your data and privacy settings
                  </p>
                  <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-white transition-colors">
                    Export Data
                  </button>
                </div>
                <div className="border-t border-neutral-700 pt-4">
                  <p className="text-sm font-medium text-red-400 mb-2">Danger Zone</p>
                  <button className="px-4 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 rounded-lg text-sm text-red-400 transition-colors">
                    Delete All Data
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      case "account":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Account Information</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Name
                  </label>
                  <input
                    type="text"
                    defaultValue={user?.name || ""}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Email
                  </label>
                  <input
                    type="email"
                    defaultValue={user?.email || ""}
                    className="w-full px-3 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-neutral-300 mb-2">
                    Role
                  </label>
                  <input
                    type="text"
                    value={user?.role || "user"}
                    disabled
                    className="w-full px-3 py-2 bg-neutral-900 border border-neutral-700 rounded-lg text-neutral-400 cursor-not-allowed"
                  />
                </div>
                <button className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 rounded-lg text-sm text-white transition-colors">
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        );
      case "security":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">Security Settings</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-300 mb-2">Change Password</p>
                  <button className="px-4 py-2 bg-neutral-800 hover:bg-neutral-700 border border-neutral-700 rounded-lg text-sm text-white transition-colors">
                    Change Password
                  </button>
                </div>
                <div className="border-t border-neutral-700 pt-4">
                  <p className="text-sm font-medium text-neutral-300 mb-2">Two-Factor Authentication</p>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" />
                    <div className="w-11 h-6 bg-neutral-700 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-500/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-500"></div>
                  </label>
                </div>
              </div>
            </div>
          </div>
        );
      case "about":
        return (
          <div className="space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-white mb-4">About</h3>
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-neutral-300 mb-2">DosiBridge Agent</p>
                  <p className="text-xs text-neutral-400">Version 1.0.0</p>
                </div>
                <div>
                  <p className="text-sm text-neutral-300 mb-2">User ID</p>
                  <p className="text-xs text-neutral-400">
                    {user?.id || "N/A"}
                  </p>
                </div>
                <div className="border-t border-neutral-700 pt-4 mt-4">
                  <a
                    href="https://github.com/dosibridge/agent-tool"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors"
                  >
                    View Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-neutral-900 border border-neutral-800 rounded-2xl shadow-2xl w-full max-w-4xl h-[80vh] flex flex-col overflow-hidden">
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
                <div className="flex-1 p-6 overflow-y-auto">
                  {renderTabContent()}
                </div>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

