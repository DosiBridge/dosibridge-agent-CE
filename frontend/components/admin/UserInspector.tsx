import React, { useEffect, useState } from 'react';
import {
    X,
    User,
    MessageSquare,
    FileText,
    Shield,
    Calendar,
    Clock,
    Trash2,
    AlertTriangle,
    CheckCircle
} from 'lucide-react';
import { deleteUserPermanently, getUserDetails, getUserSessions, getUserSessionMessages } from '@/lib/api/admin';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { format } from 'date-fns';

interface UserInspectorProps {
    userId: number;
    onClose: () => void;
    onRefetch: () => void;
}

export default function UserInspector({ userId, onClose, onRefetch }: UserInspectorProps) {
    const [details, setDetails] = useState<any>(null);
    const [sessions, setSessions] = useState<any[]>([]);
    const [activeSession, setActiveSession] = useState<string | null>(null);
    const [messages, setMessages] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMessages, setLoadingMessages] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);

    useEffect(() => {
        loadData();
    }, [userId]);

    const loadData = async () => {
        try {
            const [userStart, sessionList] = await Promise.all([
                getUserDetails(userId),
                getUserSessions(userId)
            ]);
            setDetails(userStart);
            setSessions(sessionList);
        } catch (error) {
            toast.error("Failed to load user details");
        } finally {
            setLoading(false);
        }
    };

    const loadMessages = async (sessionId: string) => {
        setActiveSession(sessionId);
        setLoadingMessages(true);
        try {
            const msgs = await getUserSessionMessages(userId, sessionId);
            setMessages(msgs);
        } catch (error) {
            toast.error("Failed to load messages");
        } finally {
            setLoadingMessages(false);
        }
    };

    const handleDelete = async () => {
        if (!confirm("Are you ABSOLUTELY sure? This action cannot be undone and will wipe all user data.")) return;

        setIsDeleting(true);
        try {
            await deleteUserPermanently(userId);
            toast.success("User permanently deleted");
            onRefetch();
            onClose();
        } catch (error) {
            toast.error("Failed to delete user");
            setIsDeleting(false);
        }
    };

    if (loading) return null;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
            onClick={(e) => e.target === e.currentTarget && onClose()}
        >
            <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                className="bg-zinc-900 border border-white/10 rounded-3xl w-full max-w-6xl max-h-[90vh] overflow-hidden shadow-2xl flex flex-col"
            >
                {/* Header */}
                <div className="p-6 border-b border-white/5 flex items-start justify-between bg-white/[0.02]">
                    <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xl font-bold">
                            {details?.profile?.name?.[0]?.toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-white">{details?.profile?.name}</h2>
                            <p className="text-zinc-400 text-sm">{details?.profile?.email}</p>
                        </div>
                        {details?.profile?.role === 'superadmin' && (
                            <span className="px-3 py-1 bg-purple-500/20 text-purple-400 text-xs font-bold rounded-full border border-purple-500/30">
                                SuperAdmin
                            </span>
                        )}
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                        <X className="w-6 h-6 text-zinc-400" />
                    </button>
                </div>

                <div className="flex flex-1 overflow-hidden">
                    {/* Sidebar Stats & Actions */}
                    <div className="w-80 border-r border-white/5 p-6 bg-black/20 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent flex-shrink-0">
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-3">
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <MessageSquare className="w-5 h-5 text-indigo-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{details?.stats?.chats}</div>
                                    <div className="text-xs text-zinc-500">Chats</div>
                                </div>
                                <div className="bg-white/5 p-4 rounded-xl border border-white/5">
                                    <FileText className="w-5 h-5 text-green-400 mb-2" />
                                    <div className="text-2xl font-bold text-white">{details?.stats?.documents}</div>
                                    <div className="text-xs text-zinc-500">Docs</div>
                                </div>
                            </div>

                            <div className="space-y-3">
                                <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-wider">Account Info</h3>
                                <div className="space-y-2 text-sm">
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-zinc-500">ID</span>
                                        <span className="text-white font-mono">{userId}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-zinc-500">Joined</span>
                                        <span className="text-white">{format(new Date(details?.profile?.created_at), 'MMM d, yyyy')}</span>
                                    </div>
                                    <div className="flex justify-between py-2 border-b border-white/5">
                                        <span className="text-zinc-500">Status</span>
                                        <span className={details?.profile?.is_active ? "text-green-400" : "text-red-400"}>
                                            {details?.profile?.is_active ? 'Active' : 'Blocked'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 border-t border-white/5">
                                <button
                                    onClick={handleDelete}
                                    disabled={isDeleting || details?.profile?.role === 'superadmin'}
                                    className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 text-red-500 border border-red-500/20 rounded-xl font-medium transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete User Permanently
                                </button>
                                <p className="text-xs text-zinc-600 mt-2 text-center">
                                    WARNING: This action is irreversible.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Main Content (Chats) */}
                    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
                        <div className="flex-1 flex min-h-0 overflow-hidden">
                            {/* Session List */}
                            <div className="w-72 border-r border-white/5 flex flex-col bg-black/10 min-h-0">
                                <div className="p-4 border-b border-white/5 flex-shrink-0 bg-zinc-900/95 backdrop-blur z-10">
                                    <h3 className="font-semibold text-white">Chat History</h3>
                                </div>
                                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent divide-y divide-white/5">
                                    {sessions.length === 0 && (
                                        <div className="p-8 text-center text-zinc-500 text-sm">No conversations found.</div>
                                    )}
                                    {sessions.map(session => (
                                        <button
                                            key={session.id}
                                            onClick={() => loadMessages(session.session_id)}
                                            className={`w-full text-left p-4 hover:bg-white/5 transition-colors ${activeSession === session.session_id ? 'bg-indigo-500/10 border-l-2 border-indigo-500' : 'border-l-2 border-transparent'}`}
                                        >
                                            <div className="text-sm font-medium text-white truncate mb-1">{session.title || 'Untitled Conversation'}</div>
                                            <div className="flex items-center justify-between text-xs text-zinc-500">
                                                <span>{session.updated_at ? format(new Date(session.updated_at), 'MMM d, HH:mm') : 'Unknown'}</span>
                                                <span className="bg-white/10 px-1.5 py-0.5 rounded">{session.message_count || 0} msgs</span>
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Message View */}
                            <div className="flex-1 bg-black/30 overflow-y-auto p-6 scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent min-h-0">
                                {!activeSession ? (
                                    <div className="h-full flex flex-col items-center justify-center text-zinc-500">
                                        <MessageSquare className="w-12 h-12 mb-4 opacity-20" />
                                        <p>Select a conversation to inspect</p>
                                    </div>
                                ) : loadingMessages ? (
                                    <div className="h-full flex items-center justify-center text-indigo-400">
                                        Loading messages...
                                    </div>
                                ) : (
                                    <div className="space-y-6 max-w-3xl mx-auto pb-6">
                                        {messages.length === 0 ? (
                                            <div className="text-center text-zinc-500 py-12">
                                                No messages in this conversation
                                            </div>
                                        ) : (
                                            messages.map((msg, idx) => (
                                                <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                                                    <div className={`max-w-[80%] rounded-2xl p-4 ${msg.role === 'user'
                                                            ? 'bg-indigo-600 text-white'
                                                            : msg.role === 'system'
                                                                ? 'bg-red-900/20 text-red-200 border border-red-500/20 w-full'
                                                                : 'bg-zinc-800 text-zinc-200'
                                                        }`}>
                                                        {msg.role === 'system' && <div className="text-xs font-bold mb-1 opacity-70 uppercase">System Prompt</div>}
                                                        <div className="whitespace-pre-wrap text-sm break-words">{msg.content || '(Empty message)'}</div>
                                                        {msg.tool_calls && (
                                                            <div className="mt-3 p-2 bg-black/20 rounded text-xs font-mono border border-white/10 overflow-x-auto">
                                                                <div className="opacity-50 mb-1">Tool Usage:</div>
                                                                <pre className="text-xs">{JSON.stringify(msg.tool_calls, null, 2)}</pre>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </motion.div>
        </motion.div>
    );
}
