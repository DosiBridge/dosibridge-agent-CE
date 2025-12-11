"use client";

import React, { useState, useRef, useEffect } from "react";
import {
  IconSettings,
  IconLogout,
  IconHelp,
  IconUserEdit,
} from "@tabler/icons-react";
import { useStore } from "@/lib/store";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

import { useAuth0 } from "@auth0/auth0-react";

interface ProfileDropdownProps {
  isOpen: boolean;
  onClose: () => void;
  onSettingsClick: () => void;
  onLogout: () => Promise<void>;
  isSidebarOpen: boolean;
}

export default function ProfileDropdown({
  isOpen,
  onClose,
  onSettingsClick,
  onLogout,
  isSidebarOpen,
}: ProfileDropdownProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const user = useStore((state) => state.user);
  const { user: auth0User } = useAuth0();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen, onClose]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await onLogout();
    } finally {
      setIsLoggingOut(false);
    }
  };

  const menuItems = [
    {
      label: "Settings",
      icon: IconSettings,
      onClick: () => {
        onSettingsClick();
        onClose();
      },
    },
    {
      label: "Edit Profile",
      icon: IconUserEdit,
      onClick: () => {
        onSettingsClick();
        onClose();
      },
    },
    {
      label: "Help",
      icon: IconHelp,
      onClick: () => {
        onSettingsClick();
        onClose();
        // Set help tab as active after a short delay to allow dialog to open
        setTimeout(() => {
          const event = new CustomEvent('profileSettingsTab', { detail: 'help' });
          window.dispatchEvent(event);
        }, 100);
      },
    },
    {
      label: "Logout",
      icon: IconLogout,
      onClick: handleLogout,
      isDestructive: true,
      disabled: isLoggingOut,
    },
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-10"
            onClick={onClose}
          />
          <motion.div
            ref={dropdownRef}
            initial={{ opacity: 0, y: isSidebarOpen ? 10 : 0, x: isSidebarOpen ? 0 : -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, x: 0, scale: 1 }}
            exit={{ opacity: 0, y: isSidebarOpen ? 10 : 0, x: isSidebarOpen ? 0 : -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "absolute bg-neutral-800 border border-neutral-700 rounded-lg shadow-xl z-50 py-1 w-64",
              isSidebarOpen
                ? "bottom-full left-0 mb-3"
                : "left-full bottom-0 ml-3 mb-0"
            )}
          >
            {/* User Info */}
            <div className="px-4 py-3 border-b border-neutral-700">
              <div className="flex items-center gap-3">
                {(user?.picture || auth0User?.picture) ? (
                  <img
                    src={user?.picture || auth0User?.picture}
                    alt={user?.name || "User"}
                    className="h-10 w-10 rounded-full border border-white/10"
                  />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10">
                    <span className="text-sm font-bold text-white">
                      {user?.name?.[0]?.toUpperCase() || "U"}
                    </span>
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-white truncate">
                    {user?.name || "User"}
                  </p>
                  <p className="text-xs text-neutral-400 truncate">
                    {user?.email || ""}
                  </p>
                </div>
              </div>
            </div>

            {/* Menu Items */}
            <div className="py-1">
              {menuItems.map((item, index) => {
                const Icon = item.icon;
                return (
                  <button
                    key={index}
                    onClick={item.onClick}
                    disabled={item.disabled}
                    className={cn(
                      "w-full px-4 py-2.5 text-left text-sm flex items-center gap-3 transition-colors",
                      item.isDestructive
                        ? "text-red-400 hover:bg-red-500/10"
                        : "text-neutral-200 hover:bg-white/10",
                      item.disabled && "opacity-50 cursor-not-allowed"
                    )}
                  >
                    {item.disabled && item.isDestructive ? (
                      <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <Icon className="w-4 h-4" />
                    )}
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}

