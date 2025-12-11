"use client";

import React, { useState } from 'react';
import {
    LayoutDashboard,
    Activity,
    Users,
    Settings,
    Sliders,
    LogOut,
    Globe,
    MessageSquare
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import { useStore } from '@/lib/store';
import { useAuth0 } from '@auth0/auth0-react';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';

export type AdminView = 'analytics' | 'activity' | 'users' | 'configure' | 'settings' | 'global' | 'appeals';

interface AdminSidebarProps {
    currentView: AdminView;
    onChangeView: (view: AdminView) => void;
}

const MENU_ITEMS: { id: AdminView; label: string; icon: React.ElementType }[] = [
    { id: 'analytics', label: 'Analytics', icon: LayoutDashboard },
    { id: 'activity', label: 'Activity', icon: Activity },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'appeals', label: 'Appeals', icon: MessageSquare },
    { id: 'global', label: 'Global', icon: Globe },
    { id: 'configure', label: 'Configure', icon: Sliders },
    { id: 'settings', label: 'Settings', icon: Settings },
];

export default function AdminSidebar({ currentView, onChangeView }: AdminSidebarProps) {
    const router = useRouter();
    const handleLogout = useStore((state) => state.handleLogout);
    const user = useStore((state) => state.user);
    const { user: auth0User, logout: auth0Logout } = useAuth0();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogoutClick = async (e: React.MouseEvent) => {
        e.preventDefault();

        if (isLoggingOut) return;

        setIsLoggingOut(true);
        try {
            // Call the logout function from store (clears local state and token)
            await handleLogout();

            // Redirect to Auth0 logout endpoint using the SDK
            auth0Logout({
                logoutParams: {
                    returnTo: window.location.origin
                }
            });
            return; // Auth0 will handle the redirect

            // Standard logout (no Auth0)
            toast.success("Logged out successfully");

            // Redirect to home page
            router.push("/");

            // Force a page reload to clear any cached state
            if (typeof window !== "undefined") {
                setTimeout(() => {
                    window.location.href = "/";
                }, 500);
            }
        } catch (error: any) {
            console.error("Logout error:", error);
            const errorMessage = error?.detail || error?.message || "Failed to logout. Please try again.";
            toast.error(errorMessage);
            setIsLoggingOut(false);
        }
    };

    return (
        <aside className="w-64 bg-zinc-900/50 backdrop-blur-xl border-r border-white/10 flex flex-col h-screen sticky top-0 bg-grid-white/[0.02] relative z-20">
            <div className="absolute inset-0 bg-zinc-900/80 pointer-events-none" />

            <div className="p-6 relative z-10">
                <div className="flex items-center gap-3 px-2 mb-10">
                    <div className="h-10 w-10 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg shadow-indigo-500/20">
                        <LayoutDashboard className="h-6 w-6 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-lg text-white block">
                            {user?.role === 'superadmin' ? 'SuperAdmin' : 'Admin'}
                        </span>
                        <span className="text-xs text-zinc-500 font-medium">Dashboard</span>
                    </div>
                </div>

                <nav className="space-y-2">
                    {MENU_ITEMS.filter(item => {
                        // Admin can only see: analytics, activity, users
                        // Superadmin can see everything including appeals
                        if (user?.role === 'admin') {
                            return ['analytics', 'activity', 'users'].includes(item.id);
                        }
                        return true; // Superadmin sees all
                    }).map((item) => {
                        const Icon = item.icon;
                        const isActive = currentView === item.id;

                        return (
                            <button
                                key={item.id}
                                onClick={() => onChangeView(item.id)}
                                className={cn(
                                    "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300 relative group overflow-hidden",
                                    isActive
                                        ? "text-white"
                                        : "text-zinc-400 hover:text-white"
                                )}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="activeTab"
                                        className="absolute inset-0 bg-white/10 rounded-xl border border-white/10"
                                        initial={false}
                                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                                    />
                                )}

                                <span className="relative z-10 flex items-center gap-3">
                                    <Icon className={cn("w-5 h-5 transition-colors", isActive ? "text-indigo-400" : "text-zinc-500 group-hover:text-indigo-400")} />
                                    {item.label}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </div>

            <div className="mt-auto p-6 border-t border-white/5 relative z-10">
                <div className="flex items-center gap-3 mb-4 px-1">
                    {(user?.picture || auth0User?.picture) ? (
                        <img
                            src={user?.picture || auth0User?.picture}
                            alt={user?.name || "User"}
                            className="h-9 w-9 rounded-full border border-white/10"
                        />
                    ) : (
                        <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center border border-white/10">
                            <span className="text-sm font-bold text-white">
                                {user?.name?.[0]?.toUpperCase() || "U"}
                            </span>
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white truncate">
                            {user?.name || auth0User?.name || "User"}
                        </p>
                        <p className="text-xs text-zinc-500 truncate">
                            {user?.email || auth0User?.email}
                        </p>
                    </div>
                </div>
                <button
                    onClick={handleLogoutClick}
                    disabled={isLoggingOut}
                    className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium text-zinc-400 hover:text-white hover:bg-red-500/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors group"
                >
                    <LogOut className={cn("w-5 h-5 transition-colors", isLoggingOut ? "animate-spin" : "group-hover:text-red-400")} />
                    {isLoggingOut ? "Logging out..." : "Logout"}
                </button>
            </div>
        </aside>
    );
}
