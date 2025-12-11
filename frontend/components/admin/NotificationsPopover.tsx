import React, { useState, useEffect } from 'react';
import { Bell, X, Check, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';
import { getNotifications, markNotificationRead, markAllNotificationsRead, type Notification } from '@/lib/api/admin';
import { useStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function NotificationsPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [loading, setLoading] = useState(true);
    const [readNotifications, setReadNotifications] = useState<Set<string>>(new Set());
    const isAuthenticated = useStore(state => state.isAuthenticated);
    const router = useRouter();

    // Fetch notifications
    useEffect(() => {
        const { accountInactive, user } = useStore.getState();
        // Don't load notifications if account is inactive
        if (accountInactive || (user && !user.is_active)) {
            setNotifications([]);
            setLoading(false);
            return;
        }

        if (isAuthenticated) {
            loadNotifications();
            // Refresh every 30 seconds
            const interval = setInterval(() => {
                const state = useStore.getState();
                // Don't refresh if account became inactive
                if (!state.accountInactive && (!state.user || state.user.is_active)) {
                    loadNotifications();
                }
            }, 30000);
            return () => clearInterval(interval);
        } else {
            setNotifications([]);
            setLoading(false);
        }
    }, [isAuthenticated]);

    // Don't render if not authenticated
    if (!isAuthenticated) {
        return null;
    }

    const loadNotifications = async () => {
        try {
            setLoading(true);
            const data = await getNotifications();
            setNotifications(data);
        } catch (error: any) {
            // Don't log errors for inactive accounts - it's expected
            if (!error?.isInactiveAccount && !(error?.message && error.message.includes("User account is inactive"))) {
                console.error('Failed to load notifications:', error);
            }
            // Clear notifications on error
            setNotifications([]);
        } finally {
            setLoading(false);
        }
    };

    // Combine API read status with local read status
    const isNotificationRead = (notification: Notification) => {
        return notification.read || readNotifications.has(notification.id);
    };

    const unreadCount = notifications.filter(n => !isNotificationRead(n)).length;

    const handleMarkAsRead = async (id: string) => {
        // Optimistically update UI
        setReadNotifications(prev => new Set(prev).add(id));
        
        try {
            await markNotificationRead(id);
        } catch (error) {
            console.error('Failed to mark notification as read:', error);
            // Revert on error
            setReadNotifications(prev => {
                const newSet = new Set(prev);
                newSet.delete(id);
                return newSet;
            });
        }
    };

    const handleMarkAllAsRead = async () => {
        // Optimistically update UI
        const allIds = new Set(notifications.map(n => n.id));
        setReadNotifications(allIds);
        
        try {
            await markAllNotificationsRead();
        } catch (error) {
            console.error('Failed to mark all notifications as read:', error);
            setReadNotifications(new Set());
        }
    };

    const handleRemove = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
        setReadNotifications(prev => {
            const newSet = new Set(prev);
            newSet.delete(id);
            return newSet;
        });
    };

    const handleNotificationClick = (notification: Notification) => {
        if (!isNotificationRead(notification)) {
            handleMarkAsRead(notification.id);
        }
        if (notification.link) {
            setIsOpen(false);
            router.push(notification.link);
        }
    };

    const getIcon = (type: Notification['type']) => {
        switch (type) {
            case 'success': return <Check className="w-4 h-4 text-green-400" />;
            case 'warning': return <AlertTriangle className="w-4 h-4 text-yellow-400" />;
            case 'error': return <AlertCircle className="w-4 h-4 text-red-400" />;
            default: return <Info className="w-4 h-4 text-blue-400" />;
        }
    };

    const getBgColor = (type: Notification['type']) => {
        switch (type) {
            case 'success': return 'bg-green-500/10 border-green-500/20';
            case 'warning': return 'bg-yellow-500/10 border-yellow-500/20';
            case 'error': return 'bg-red-500/10 border-red-500/20';
            default: return 'bg-blue-500/10 border-blue-500/20';
        }
    };

    return (
        <div className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={cn(
                    "relative p-2 transition-colors rounded-full hover:bg-white/5",
                    isOpen ? "text-white bg-white/5" : "text-zinc-400 hover:text-white"
                )}
            >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-indigo-500 rounded-full border-2 border-[#18181b]" />
                )}
            </button>

            <AnimatePresence>
                {isOpen && (
                    <>
                        <div
                            className="fixed inset-0 z-40"
                            onClick={() => setIsOpen(false)}
                        />
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-[#18181b] border border-white/10 rounded-2xl shadow-xl z-50 overflow-hidden flex flex-col max-h-[80vh]"
                        >
                            <div className="p-4 border-b border-white/10 flex items-center justify-between bg-zinc-900/50">
                                <div className="flex items-center gap-2">
                                    <h3 className="font-semibold text-white">Notifications</h3>
                                    {unreadCount > 0 && (
                                        <span className="px-1.5 py-0.5 text-xs font-medium bg-indigo-500/20 text-indigo-400 rounded-md">
                                            {unreadCount} new
                                        </span>
                                    )}
                                </div>
                                {unreadCount > 0 && (
                                    <button
                                        onClick={handleMarkAllAsRead}
                                        className="text-xs text-zinc-400 hover:text-white transition-colors"
                                    >
                                        Mark all as read
                                    </button>
                                )}
                            </div>

                            <div className="overflow-y-auto flex-1 p-2 space-y-2">
                                {loading ? (
                                    <div className="py-8 text-center text-zinc-500">
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50 animate-pulse" />
                                        <p className="text-sm">Loading notifications...</p>
                                    </div>
                                ) : notifications.length === 0 ? (
                                    <div className="py-8 text-center text-zinc-500">
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No notifications</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => {
                                        const isRead = isNotificationRead(notification);
                                        const timestamp = new Date(notification.timestamp);
                                        return (
                                            <motion.div
                                                layout
                                                key={notification.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                onClick={() => handleNotificationClick(notification)}
                                                className={cn(
                                                    "relative p-3 rounded-xl border transition-all duration-200 group cursor-pointer",
                                                    getBgColor(notification.type),
                                                    !isRead && "bg-white/5",
                                                    notification.link && "hover:bg-white/10"
                                                )}
                                            >
                                                <div className="flex gap-3">
                                                    <div className={cn("mt-1 flex-shrink-0")}>
                                                        {getIcon(notification.type)}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <div className="flex items-start justify-between gap-2">
                                                            <h4 className={cn("text-sm font-medium truncate pr-4", isRead ? "text-zinc-400" : "text-white")}>
                                                                {notification.title}
                                                            </h4>
                                                            <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                                {formatDistanceToNow(timestamp, { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                        <p className="text-xs text-zinc-400 mt-1 leading-normal line-clamp-2">
                                                            {notification.message}
                                                        </p>

                                                        <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            {!isRead && (
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleMarkAsRead(notification.id);
                                                                    }}
                                                                    className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                                                                >
                                                                    Mark as read
                                                                </button>
                                                            )}
                                                            <button
                                                                onClick={(e) => {
                                                                    e.stopPropagation();
                                                                    handleRemove(notification.id);
                                                                }}
                                                                className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
                                                            >
                                                                Dismiss
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {!isRead && (
                                                        <div className="absolute top-4 right-3 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                    )}
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
