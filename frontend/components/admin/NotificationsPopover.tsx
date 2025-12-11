import React, { useState } from 'react';
import { Bell, X, Check, Info, AlertTriangle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { formatDistanceToNow } from 'date-fns';

export interface Notification {
    id: string;
    title: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: Date;
    read: boolean;
}

// Mock notifications for now
const MOCK_NOTIFICATIONS: Notification[] = [
    {
        id: '1',
        title: 'System Update',
        message: 'System effectively updated to version 2.4.0 with new dashboard features.',
        type: 'success',
        timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 mins ago
        read: false,
    },
    {
        id: '2',
        title: 'High Token Usage',
        message: 'Global token usage has reached 80% of the daily limit.',
        type: 'warning',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
        read: false,
    },
    {
        id: '3',
        title: 'New User Registration',
        message: 'User "John Doe" has registered and requires approval.',
        type: 'info',
        timestamp: new Date(Date.now() - 1000 * 60 * 60 * 5), // 5 hours ago
        read: true,
    },
];

export default function NotificationsPopover() {
    const [isOpen, setIsOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>(MOCK_NOTIFICATIONS);

    const unreadCount = notifications.filter(n => !n.read).length;

    const handleMarkAsRead = (id: string) => {
        setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    };

    const handleMarkAllAsRead = () => {
        setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    };

    const handleRemove = (id: string) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
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
                                {notifications.length === 0 ? (
                                    <div className="py-8 text-center text-zinc-500">
                                        <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                        <p className="text-sm">No notifications</p>
                                    </div>
                                ) : (
                                    notifications.map((notification) => (
                                        <motion.div
                                            layout
                                            key={notification.id}
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 20 }}
                                            className={cn(
                                                "relative p-3 rounded-xl border transition-all duration-200 group",
                                                getBgColor(notification.type),
                                                !notification.read && "bg-white/5"
                                            )}
                                        >
                                            <div className="flex gap-3">
                                                <div className={cn("mt-1 flex-shrink-0")}>
                                                    {getIcon(notification.type)}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="flex items-start justify-between gap-2">
                                                        <h4 className={cn("text-sm font-medium truncate pr-4", notification.read ? "text-zinc-400" : "text-white")}>
                                                            {notification.title}
                                                        </h4>
                                                        <span className="text-[10px] text-zinc-500 whitespace-nowrap">
                                                            {formatDistanceToNow(notification.timestamp, { addSuffix: true })}
                                                        </span>
                                                    </div>
                                                    <p className="text-xs text-zinc-400 mt-1 leading-normal line-clamp-2">
                                                        {notification.message}
                                                    </p>

                                                    <div className="flex items-center gap-3 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        {!notification.read && (
                                                            <button
                                                                onClick={() => handleMarkAsRead(notification.id)}
                                                                className="text-[10px] font-medium text-indigo-400 hover:text-indigo-300"
                                                            >
                                                                Mark as read
                                                            </button>
                                                        )}
                                                        <button
                                                            onClick={() => handleRemove(notification.id)}
                                                            className="text-[10px] font-medium text-zinc-500 hover:text-zinc-300"
                                                        >
                                                            Dismiss
                                                        </button>
                                                    </div>
                                                </div>

                                                {!notification.read && (
                                                    <div className="absolute top-4 right-3 w-1.5 h-1.5 rounded-full bg-indigo-500" />
                                                )}
                                            </div>
                                        </motion.div>
                                    ))
                                )}
                            </div>
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
        </div>
    );
}
