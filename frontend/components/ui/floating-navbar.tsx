"use client";
import React, { useState, useEffect, useRef } from "react";
import {
    motion,
    AnimatePresence,
    useScroll,
    useMotionValueEvent,
} from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { useStore } from "@/lib/store";
import { Bot, ExternalLink, Shield, LayoutDashboard, ChevronDown } from "lucide-react";
import { getAuthToken } from "@/lib/api/client";

interface DropdownItem {
    title: string;
    description: string;
    link: string;
    external?: boolean;
}

export const FloatingNav = ({
    navItems,
    className,
}: {
    navItems: {
        name: string;
        link: string;
        icon?: React.ReactNode;
        dropdown?: DropdownItem[];
    }[];
    className?: string;
}) => {
    const { scrollYProgress } = useScroll();
    const isAuthenticated = useStore((state) => state.isAuthenticated);
    const user = useStore((state) => state.user);
    const [hasAuthToken, setHasAuthToken] = useState(false);
    
    // Check user role
    const userRole = user?.role;
    const isSuperAdmin = userRole === 'superadmin';
    const isAdmin = userRole === 'admin';

    const [visible, setVisible] = useState(true);
    const [hoveredItem, setHoveredItem] = useState<number | null>(null);
    const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

    // Check for auth token in localStorage as fallback
    useEffect(() => {
        const checkToken = () => {
            const token = getAuthToken();
            setHasAuthToken(!!token);
        };
        // Initial check
        checkToken();
        // Listen to storage events (when token is added/removed in other tabs or by the app)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === "auth_token") {
                checkToken();
            }
        };
        window.addEventListener("storage", handleStorageChange);
        // Also check when isAuthenticated changes
        const interval = setInterval(checkToken, 500);
        return () => {
            window.removeEventListener("storage", handleStorageChange);
            clearInterval(interval);
        };
    }, [isAuthenticated]); // Re-run when isAuthenticated changes

    // Use isAuthenticated from store, or fallback to checking token directly
    const userIsAuthenticated = isAuthenticated || hasAuthToken;

    useMotionValueEvent(scrollYProgress, "change", (current) => {
        // Navbar is always visible
        setVisible(true);
    });

    return (
        <AnimatePresence mode="wait">
            <motion.div
                initial={{
                    opacity: 1,
                    y: -100,
                }}
                animate={{
                    y: visible ? 0 : -100,
                    opacity: visible ? 1 : 0,
                }}
                transition={{
                    duration: 0.2,
                }}
                className={cn(
                    "flex max-w-[95vw] sm:max-w-fit fixed top-4 sm:top-10 inset-x-0 mx-auto border border-white/[0.2] rounded-full bg-black/80 backdrop-blur-xl shadow-[0px_2px_3px_-1px_rgba(0,0,0,0.1),0px_1px_0px_0px_rgba(25,28,33,0.02),0px_0px_0px_1px_rgba(25,28,33,0.08)] z-[5000] px-2 sm:px-3 py-1.5 sm:py-2 items-center justify-center gap-1 sm:gap-2 overflow-visible",
                    className
                )}
            >
                {/* DosiBridge Logo */}
                <Link
                    href="/"
                    className="flex items-center gap-1.5 sm:gap-2 px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group flex-shrink-0"
                >
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow flex-shrink-0">
                        <Bot className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
                    </div>
                    <span className="hidden lg:block text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                        DosiBridge
                    </span>
                </Link>

                <div className="h-5 sm:h-6 w-px bg-white/20 flex-shrink-0 hidden sm:block" />

                {/* Nav Items with Hover Dropdowns */}
                {navItems.map((navItem: any, idx: number) => {
                    const hasDropdown = navItem.dropdown && navItem.dropdown.length > 0;
                    const isHovered = hoveredItem === idx;
                    
                    return (
                        <div
                            key={`nav-item-${idx}`}
                            className="relative z-10"
                            onMouseEnter={() => {
                                if (hoverTimeoutRef.current) {
                                    clearTimeout(hoverTimeoutRef.current);
                                    hoverTimeoutRef.current = null;
                                }
                                if (hasDropdown) {
                                    setHoveredItem(idx);
                                }
                            }}
                            onMouseLeave={() => {
                                hoverTimeoutRef.current = setTimeout(() => {
                                    setHoveredItem(null);
                                }, 150);
                            }}
                        >
                    <Link
                        href={navItem.link}
                        className={cn(
                                    "relative text-neutral-50 items-center flex px-1.5 sm:px-2 py-1 rounded-lg hover:bg-white/5 hover:text-neutral-300 transition-colors text-xs sm:text-sm whitespace-nowrap flex-shrink-0",
                                    isHovered && hasDropdown && "bg-white/5 text-neutral-300"
                        )}
                    >
                        <span className="block sm:hidden">{navItem.icon}</span>
                                <span className="hidden sm:flex items-center gap-1">
                                    {navItem.name}
                                    {hasDropdown && (
                                        <ChevronDown className={cn(
                                            "w-3 h-3 transition-transform duration-200",
                                            isHovered && "rotate-180"
                                        )} />
                                    )}
                                </span>
                            </Link>
                            
                            {/* Dropdown Menu */}
                            {hasDropdown && (
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                            transition={{ duration: 0.15, ease: "easeOut" }}
                                            className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-80 bg-black/98 backdrop-blur-xl border border-white/20 rounded-xl shadow-2xl z-[10000] overflow-hidden pointer-events-auto"
                                            style={{ 
                                                boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.2)"
                                            }}
                                            onMouseEnter={() => {
                                                if (hoverTimeoutRef.current) {
                                                    clearTimeout(hoverTimeoutRef.current);
                                                    hoverTimeoutRef.current = null;
                                                }
                                                setHoveredItem(idx);
                                            }}
                                            onMouseLeave={() => {
                                                hoverTimeoutRef.current = setTimeout(() => {
                                                    setHoveredItem(null);
                                                }, 150);
                                            }}
                                        >
                                            <div className="p-2">
                                                {navItem.dropdown.map((item: DropdownItem, itemIdx: number) => (
                                                    <Link
                                                        key={itemIdx}
                                                        href={item.link}
                                                        target={item.external ? "_blank" : undefined}
                                                        rel={item.external ? "noopener noreferrer" : undefined}
                                                        className="block p-3 rounded-lg hover:bg-white/10 transition-colors group cursor-pointer"
                                                        onClick={(e) => {
                                                            if (!item.external && item.link.startsWith("#")) {
                                                                e.preventDefault();
                                                                const element = document.querySelector(item.link);
                                                                if (element) {
                                                                    element.scrollIntoView({ behavior: "smooth" });
                                                                }
                                                            }
                                                        }}
                                                    >
                                                        <div className="flex items-start gap-3">
                                                            <div className="flex-1 min-w-0">
                                                                <h4 className="text-sm font-semibold text-white group-hover:text-indigo-300 transition-colors">
                                                                    {item.title}
                                                                </h4>
                                                                <p className="text-xs text-neutral-400 mt-1 line-clamp-2">
                                                                    {item.description}
                                                                </p>
                                                            </div>
                                                            {item.external && (
                                                                <ExternalLink className="w-4 h-4 text-neutral-500 group-hover:text-indigo-400 transition-colors flex-shrink-0 mt-0.5" />
                                                            )}
                                                        </div>
                    </Link>
                ))}
                                            </div>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    );
                })}

                <div className="h-5 sm:h-6 w-px bg-white/20 flex-shrink-0 hidden md:block" />

                {/* Powered by DosiBridge - Hide on mobile */}
                <Link
                    href="https://dosibridge.com"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden md:flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group text-xs text-neutral-400 hover:text-neutral-200 whitespace-nowrap flex-shrink-0"
                >
                    <span className="hidden lg:inline">Powered by</span>
                    <span className="font-medium">dosibridge.com</span>
                    <ExternalLink className="w-3 h-3 opacity-50 group-hover:opacity-100 transition-opacity flex-shrink-0" />
                </Link>


                {/* Dashboard Link - Available to all authenticated users */}
                {userIsAuthenticated && (
                    <>
                        <div className="h-5 sm:h-6 w-px bg-white/20 flex-shrink-0 hidden sm:block" />
                        <Link
                            href="/dashboard"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group text-xs sm:text-sm text-neutral-300 hover:text-white whitespace-nowrap flex-shrink-0"
                            title="My Dashboard"
                        >
                            <LayoutDashboard className="w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0 text-indigo-400" />
                            <span className="hidden sm:inline font-medium">Dashboard</span>
                        </Link>
                    </>
                )}

                {/* Admin/SuperAdmin Dashboard Link */}
                {userIsAuthenticated && (isSuperAdmin || isAdmin) && (
                    <>
                        <div className="h-5 sm:h-6 w-px bg-white/20 flex-shrink-0 hidden sm:block" />
                        <Link
                            href="/admin"
                            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors group text-xs sm:text-sm text-neutral-300 hover:text-white whitespace-nowrap flex-shrink-0"
                            title={isSuperAdmin ? "SuperAdmin Dashboard" : "Admin Dashboard"}
                        >
                            <Shield className={cn(
                                "w-3.5 h-3.5 sm:w-4 sm:h-4 opacity-70 group-hover:opacity-100 transition-opacity flex-shrink-0",
                                isSuperAdmin ? "text-purple-400" : "text-blue-400"
                            )} />
                            <span className="hidden sm:inline font-medium">
                                {isSuperAdmin ? "SuperAdmin" : "Admin"}
                            </span>
                        </Link>
                    </>
                )}

                {userIsAuthenticated ? (
                    <Link
                        href="/chat"
                        className="border text-xs sm:text-sm font-medium relative border-white/[0.2] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-200 group whitespace-nowrap flex-shrink-0"
                    >
                        <span className="relative z-10">Chat Now</span>
                        <span className="absolute inset-x-0 w-1/2 mx-auto -bottom-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                ) : (
                    <Link
                        href="/auth/login"
                        className="border text-xs sm:text-sm font-medium relative border-white/[0.2] text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-full hover:border-indigo-500/50 hover:bg-indigo-500/10 transition-all duration-200 group whitespace-nowrap flex-shrink-0"
                    >
                        <span className="relative z-10">Login</span>
                        <span className="absolute inset-x-0 w-1/2 mx-auto -bottom-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent h-px opacity-0 group-hover:opacity-100 transition-opacity" />
                    </Link>
                )}
            </motion.div>
        </AnimatePresence >
    );
};
