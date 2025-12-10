"use client";
import React, { useState } from "react";
import { Sidebar, SidebarBody, SidebarLink } from "./ui/sidebar";
import {
  IconArrowLeft,
  IconBrandTabler,
  IconSettings,
  IconUserBolt,
  IconMessage2,
  IconPlus,
  IconTrash,
  IconLogin,
  IconLogout,
  IconUserPlus,
  IconDots,
  IconEdit,
  IconShare,
  IconCopy,
} from "@tabler/icons-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { type Session } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";
import toast from "react-hot-toast";
import ProfileDropdown from "./ProfileDropdown";
import ProfileSettingsDialog from "./ProfileSettingsDialog";

interface SessionSidebarProps {
  isOpen: boolean; // Kept for compatibility but controlled internally by common parent usually
  onClose: () => void;
  onToggle: () => void;
}

export default function SessionSidebar({
  isOpen,
  onClose,
  onToggle,
}: SessionSidebarProps) {
  // Use props for open state
  const open = isOpen;
  const setOpen = (value: boolean | ((prevState: boolean) => boolean)) => {
    // Determine new value
    const newValue = typeof value === 'function' ? value(open) : value;
    if (newValue !== open) {
      if (newValue) {
        onToggle();
      } else {
        onClose();
      }
    }
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [creatingSession, setCreatingSession] = useState(false);
  const [deletingSessionId, setDeletingSessionId] = useState<string | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [renamingSessionId, setRenamingSessionId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [profileSettingsOpen, setProfileSettingsOpen] = useState(false);

  const sessions = useStore((state) => state.sessions);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const setCurrentSession = useStore((state) => state.setCurrentSession);
  const createNewSession = useStore((state) => state.createNewSession);
  const deleteSession = useStore((state) => state.deleteSession);
  const updateSessionTitle = useStore((state) => state.updateSessionTitle);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const user = useStore((state) => state.user);
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const logout = useStore((state) => state.handleLogout);

  const links = [
    {
      label: "New Chat",
      href: "#",
      icon: creatingSession ? (
        <div className="h-5 w-5 flex items-center justify-center">
          <div className="w-4 h-4 border-2 border-neutral-200 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <IconPlus className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
      onClick: async () => {
        if (creatingSession) return;
        setCreatingSession(true);
        try {
          await createNewSession();
        } finally {
          setCreatingSession(false);
        }
      },
    },
    {
      label: "Settings",
      href: "#",
      icon: (
        <IconSettings className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
      onClick: () => setSettingsOpen(true),
    },
  ];

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-neutral-800 border border-neutral-700 relative z-50",
        "h-full bg-transparent border-none" // Override for transparency
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-6 bg-transparent/50 backdrop-blur-xl border-r border-white/10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden min-h-0">
            {/* Logo Section */}
            <div className="flex flex-col mb-6">
              {open ? (
                <Logo onClick={onToggle} />
              ) : (
                <LogoIcon onClick={onToggle} />
              )}
            </div>

            {/* Static Actions */}
            <div className="flex flex-col gap-1 mb-6">
              {links.map((link, idx) => (
                <div
                  key={idx}
                  onClick={link.onClick ? (e) => {
                    e.preventDefault();
                    link.onClick?.();
                  } : undefined}
                  className="w-full"
                >
                  <SidebarLink link={link} />
                </div>
              ))}
            </div>

            {/* Sessions List */}
            <div className="flex flex-col gap-1 flex-1 min-h-0">
              <motion.span
                animate={{ opacity: open ? 1 : 0 }}
                className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 px-2 truncate"
              >
                Recent Chats
              </motion.span>

              <div className="flex flex-col gap-1 overflow-y-auto flex-1 min-h-0">
                {sessions.slice(0, 10).map((session, idx) => (
                  <SessionItem
                    key={session.session_id || idx}
                    session={session}
                    isActive={currentSessionId === session.session_id}
                    isOpen={open}
                    openMenuId={openMenuId}
                    setOpenMenuId={setOpenMenuId}
                    renamingSessionId={renamingSessionId}
                    setRenamingSessionId={setRenamingSessionId}
                    renameValue={renameValue}
                    setRenameValue={setRenameValue}
                    deletingSessionId={deletingSessionId}
                    setDeletingSessionId={setDeletingSessionId}
                    onSelect={() => setCurrentSession(session.session_id)}
                    onDelete={deleteSession}
                    onRename={updateSessionTitle}
                  />
                ))}
                {sessions.length === 0 && (
                  <div className="px-2 py-4 text-xs text-neutral-500 text-center">
                    No conversations yet
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* User Profile / Auth Actions */}
          <div className="flex-shrink-0 pt-4 border-t border-white/10 relative">
            {isAuthenticated ? (
              <div className="flex flex-col gap-1">
                <div className="relative">
                  <div
                    onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                    className="cursor-pointer"
                  >
                    <SidebarLink
                      link={{
                        label: user?.name || "User",
                        href: "#",
                        icon: (
                          <div className="h-5 w-5 flex-shrink-0 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10">
                            <span className="text-[10px] font-bold text-white">{user?.name?.[0]?.toUpperCase() || "U"}</span>
                          </div>
                        ),
                      }}
                    />
                  </div>
                  <ProfileDropdown
                    isOpen={profileDropdownOpen}
                    onClose={() => setProfileDropdownOpen(false)}
                    isSidebarOpen={open}
                    onSettingsClick={() => setProfileSettingsOpen(true)}
                    onLogout={async () => {
                      if (isLoggingOut) return;
                      setIsLoggingOut(true);
                      try {
                        await logout();
                      } finally {
                        setIsLoggingOut(false);
                      }
                    }}
                  />
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-1">
                <SidebarLink
                  link={{
                    label: "Login",
                    href: "/login",
                    icon: <IconLogin className="text-neutral-200 h-5 w-5 flex-shrink-0" />,
                  }}
                />
                <SidebarLink
                  link={{
                    label: "Create Account",
                    href: "/register",
                    icon: <IconUserPlus className="text-neutral-200 h-5 w-5 flex-shrink-0" />,
                  }}
                />
              </div>
            )}
          </div>

          {/* Profile Settings Dialog */}
          <ProfileSettingsDialog
            isOpen={profileSettingsOpen}
            onClose={() => setProfileSettingsOpen(false)}
          />
        </SidebarBody>
      </Sidebar>
    </div>
  );
}

export const Logo = ({ onClick }: { onClick?: () => void }) => {
  return (
    <div
      onClick={onClick}
      className="font-normal flex items-center gap-3 text-sm text-white py-2 px-2 relative z-20 cursor-pointer"
    >
      <div className="h-5 w-5 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-white whitespace-pre flex-1"
      >
        DosiBridge
      </motion.span>
    </div>
  );
};
export const LogoIcon = ({ onClick }: { onClick?: () => void }) => {
  return (
    <div
      onClick={onClick}
      className="font-normal flex items-center justify-start text-sm text-white py-2 px-2 relative z-20 w-full cursor-pointer"
    >
      <div className="h-5 w-5 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0 flex items-center justify-center" />
    </div>
  );
};

interface SessionItemProps {
  session: Session;
  isActive: boolean;
  isOpen: boolean;
  openMenuId: string | null;
  setOpenMenuId: (id: string | null) => void;
  renamingSessionId: string | null;
  setRenamingSessionId: (id: string | null) => void;
  renameValue: string;
  setRenameValue: (value: string) => void;
  deletingSessionId: string | null;
  setDeletingSessionId: (id: string | null) => void;
  onSelect: () => void;
  onDelete: (sessionId: string) => Promise<void>;
  onRename: (sessionId: string, title: string) => Promise<void>;
}

function SessionItem({
  session,
  isActive,
  isOpen,
  openMenuId,
  setOpenMenuId,
  renamingSessionId,
  setRenamingSessionId,
  renameValue,
  setRenameValue,
  deletingSessionId,
  setDeletingSessionId,
  onSelect,
  onDelete,
  onRename,
}: SessionItemProps) {
  const isMenuOpen = openMenuId === session.session_id;
  const isRenaming = renamingSessionId === session.session_id;
  const isDeleting = deletingSessionId === session.session_id;

  const handleRename = async () => {
    if (!renameValue.trim()) {
      setRenamingSessionId(null);
      setRenameValue("");
      return;
    }
    try {
      await onRename(session.session_id, renameValue.trim());
      toast.success("Session renamed successfully!");
    } catch (error) {
      console.error("Failed to rename session:", error);
      toast.error("Failed to rename session");
    } finally {
      setRenamingSessionId(null);
      setRenameValue("");
    }
  };

  const handleShare = async () => {
    try {
      const url = `${window.location.origin}/chat?session=${session.session_id}`;
      await navigator.clipboard.writeText(url);
      toast.success("Chat link copied to clipboard!");
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to copy link:", error);
      toast.error("Failed to copy link");
    }
  };

  const handleCopySessionId = async () => {
    try {
      await navigator.clipboard.writeText(session.session_id);
      toast.success("Session ID copied to clipboard!");
      setOpenMenuId(null);
    } catch (error) {
      console.error("Failed to copy session ID:", error);
      toast.error("Failed to copy session ID");
    }
  };

  const handleDelete = async () => {
    if (isDeleting) return;
    setDeletingSessionId(session.session_id);
    setOpenMenuId(null);
    try {
      await onDelete(session.session_id);
    } finally {
      setDeletingSessionId(null);
    }
  };

  return (
    <div
      className="group relative w-full"
      onClick={!isRenaming ? onSelect : undefined}
    >
      {isRenaming ? (
        <div className="px-2 py-2 bg-white/5 rounded-md">
          <input
            type="text"
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                handleRename();
              } else if (e.key === "Escape") {
                setRenamingSessionId(null);
                setRenameValue("");
              }
            }}
            autoFocus
            className="w-full px-2 py-1 bg-white/10 border border-white/20 rounded text-sm text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-white/30"
            placeholder="Enter new name..."
          />
        </div>
      ) : (
        <>
          <SidebarLink
            link={{
              label: session.title || "New Conversation",
              href: "#",
              icon: <IconMessage2 className="text-neutral-200 h-5 w-5 flex-shrink-0" />,
            }}
            className={cn(
              isActive && "bg-white/10 rounded-md",
              "w-full"
            )}
          />
          {isOpen && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenMenuId(isMenuOpen ? null : session.session_id);
                }}
                className="p-1.5 hover:bg-white/10 rounded-md"
                aria-label="Session options"
              >
                <IconDots className="w-4 h-4 text-neutral-300" />
              </button>
              {isMenuOpen && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={(e) => {
                      e.stopPropagation();
                      setOpenMenuId(null);
                    }}
                  />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-neutral-800 border border-neutral-700 rounded-lg shadow-lg z-20 py-1">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setRenameValue(session.title || "New Conversation");
                        setRenamingSessionId(session.session_id);
                        setOpenMenuId(null);
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-white/10 flex items-center gap-2"
                    >
                      <IconEdit className="w-4 h-4" />
                      Rename
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleShare();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-white/10 flex items-center gap-2"
                    >
                      <IconShare className="w-4 h-4" />
                      Share Chat
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleCopySessionId();
                      }}
                      className="w-full px-4 py-2 text-left text-sm text-neutral-200 hover:bg-white/10 flex items-center gap-2"
                    >
                      <IconCopy className="w-4 h-4" />
                      Copy Session ID
                    </button>
                    <div className="border-t border-neutral-700 my-1" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete();
                      }}
                      disabled={isDeleting}
                      className="w-full px-4 py-2 text-left text-sm text-red-400 hover:bg-red-500/10 flex items-center gap-2 disabled:opacity-50"
                    >
                      {isDeleting ? (
                        <>
                          <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin" />
                          Deleting...
                        </>
                      ) : (
                        <>
                          <IconTrash className="w-4 h-4" />
                          Delete
                        </>
                      )}
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
