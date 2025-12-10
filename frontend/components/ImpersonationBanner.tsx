"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { LogIn, LogOut, Shield } from "lucide-react";
import { getCurrentUser } from "@/lib/api/auth";
import type { User } from "@/types/api";

export default function ImpersonationBanner() {
    const router = useRouter();
    const impersonatedUserId = useStore((state) => state.impersonatedUserId);
    const setImpersonatedUserId = useStore((state) => state.setImpersonatedUserId);
    const originalSuperadminId = useStore((state) => state.originalSuperadminId);
    const user = useStore((state) => state.user);
    const [impersonatedUser, setImpersonatedUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // When impersonating, fetch the impersonated user's info
        if (impersonatedUserId) {
            setLoading(true);
            getCurrentUser()
                .then((currentUser) => {
                    // The API returns the impersonated user when X-Impersonate-User header is set
                    setImpersonatedUser(currentUser);
                })
                .catch((error) => {
                    console.error("Failed to fetch impersonated user:", error);
                })
                .finally(() => {
                    setLoading(false);
                });
        } else {
            setImpersonatedUser(null);
        }
    }, [impersonatedUserId]);

    // Show banner whenever impersonating (regardless of current user role)
    if (!impersonatedUserId) {
        return null;
    }

    const displayUser = impersonatedUser || user;

    // Don't render if we don't have user info yet
    if (!displayUser) {
        return null;
    }

    const handleBannerClick = () => {
        router.push("/chat");
    };

    return (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-4 duration-300">
            <div className="bg-indigo-950/80 backdrop-blur-md border border-indigo-500/30 shadow-2xl shadow-indigo-500/20 rounded-2xl p-4 flex items-center gap-6 max-w-lg">
                <div 
                    onClick={handleBannerClick}
                    className="flex items-center gap-4 cursor-pointer hover:opacity-80 transition-opacity flex-1"
                    title="Click to go to chat page"
                >
                    <div className="p-2.5 bg-indigo-500/20 rounded-xl border border-indigo-500/30">
                        <Shield className="w-5 h-5 text-indigo-300" />
                    </div>
                    <div className="flex flex-col">
                        <span className="text-xs font-medium text-indigo-300 uppercase tracking-wider mb-0.5">
                            Persistent Access Active
                        </span>
                        <div className="flex items-baseline gap-2">
                            <span className="text-sm font-semibold text-white">
                                {displayUser.name}
                            </span>
                            <span className="text-xs text-white/50">
                                {displayUser.email}
                            </span>
                        </div>
                    </div>
                </div>

                <div className="h-8 w-px bg-white/10" />

                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {originalSuperadminId && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                setImpersonatedUserId(originalSuperadminId);
                                if (typeof window !== 'undefined') {
                                    window.location.reload();
                                }
                            }}
                            className="p-2 hover:bg-white/10 rounded-lg text-white/70 hover:text-white transition-colors"
                            title="Return to Superadmin View"
                        >
                            <Shield className="w-4 h-4" />
                        </button>
                    )}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            setImpersonatedUserId(null);
                            if (typeof window !== 'undefined') {
                                window.location.reload();
                            }
                        }}
                        className="flex items-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-lg transition-all shadow-lg shadow-indigo-500/20 hover:shadow-indigo-500/40"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        Exit Access
                    </button>
                </div>
            </div>
        </div>
    );
}
