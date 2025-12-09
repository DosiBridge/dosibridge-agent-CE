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
} from "@tabler/icons-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useStore } from "@/lib/store";
import { type Session } from "@/lib/api";
import { formatDistanceToNow } from "date-fns";

interface SessionSidebarProps {
  isOpen: boolean; // Kept for compatibility but controlled internally by common parent usually
  onClose: () => void;
  onToggle: () => void;
}

export default function SessionSidebar({
  isOpen, // Not fully using this props as Aceternity Sidebar handles its own state usually, but will sync
  onClose,
  onToggle,
}: SessionSidebarProps) {
  const [open, setOpen] = useState(false);

  const sessions = useStore((state) => state.sessions);
  const currentSessionId = useStore((state) => state.currentSessionId);
  const loadSession = useStore((state) => state.loadSession);
  const createNewSession = useStore((state) => state.createNewSession);
  const deleteSession = useStore((state) => state.deleteSession);
  const setSettingsOpen = useStore((state) => state.setSettingsOpen);
  const user = useStore((state) => state.user);

  const links = [
    {
      label: "New Chat",
      href: "#",
      icon: (
        <IconPlus className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
      onClick: () => createNewSession(),
    },
    {
      label: "Settings",
      href: "#",
      icon: (
        <IconSettings className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
      onClick: () => setSettingsOpen(true),
    },
    {
      label: "Profile",
      href: "#",
      icon: (
        <IconUserBolt className="text-neutral-200 h-5 w-5 flex-shrink-0" />
      ),
    },
  ];

  return (
    <div
      className={cn(
        "rounded-md flex flex-col md:flex-row bg-neutral-800 border border-neutral-700 overflow-hidden",
        "h-full bg-transparent border-none" // Override for transparency
      )}
    >
      <Sidebar open={open} setOpen={setOpen}>
        <SidebarBody className="justify-between gap-10 bg-transparent/50 backdrop-blur-xl border-r border-white/10">
          <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
            {/* Logo Section */}
            <div className="flex flex-col">
              {open ? <Logo /> : <LogoIcon />}
            </div>

            {/* Static Actions */}
            <div className="mt-8 flex flex-col gap-2">
              {links.map((link, idx) => (
                <div key={idx} onClick={link.onClick ? (e) => { e.preventDefault(); link.onClick?.(); } : undefined}>
                  <SidebarLink link={link} />
                </div>
              ))}
            </div>

            {/* Sessions List */}
            <div className="mt-8 flex flex-col gap-2">
              <motion.span
                animate={{ opacity: open ? 1 : 0 }}
                className="text-xs font-semibold text-neutral-400 uppercase tracking-wider mb-2 pl-2 truncate"
              >
                Recent Chats
              </motion.span>

              {sessions.slice(0, 10).map((session, idx) => (
                <div key={session.id || idx} className="group relative" onClick={() => loadSession(session.id)}>
                  <SidebarLink
                    link={{
                      label: session.title || "New Conversation",
                      href: "#",
                      icon: <IconMessage2 className="text-neutral-200 h-5 w-5 flex-shrink-0" />,
                    }}
                    className={cn(currentSessionId === session.id && "bg-white/10 rounded-md")}
                  />
                  {open && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteSession(session.id);
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
                    >
                      <IconTrash className="w-4 h-4 text-red-400" />
                    </button>
                  )}
                </div>
              ))}
            </div>

          </div>

          {/* User Profile */}
          <div>
            <SidebarLink
              link={{
                label: user?.name || "Guest User",
                href: "#",
                icon: (
                  <div className="h-7 w-7 flex-shrink-0 rounded-full bg-black/50 flex items-center justify-center">
                    <span className="text-xs font-bold">{user?.name?.[0]?.toUpperCase() || "G"}</span>
                  </div>
                ),
              }}
            />
          </div>
        </SidebarBody>
      </Sidebar>
    </div>
  );
}

export const Logo = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
      <motion.span
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="font-medium text-white whitespace-pre"
      >
        DosiBridge
      </motion.span>
    </Link>
  );
};
export const LogoIcon = () => {
  return (
    <Link
      href="#"
      className="font-normal flex space-x-2 items-center text-sm text-white py-1 relative z-20"
    >
      <div className="h-5 w-6 bg-white rounded-br-lg rounded-tr-sm rounded-tl-lg rounded-bl-sm flex-shrink-0" />
    </Link>
  );
};
