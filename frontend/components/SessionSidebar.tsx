/**
 * Session sidebar component
 */

'use client';

import { deleteSession } from '@/lib/api';
import { useStore } from '@/lib/store';
import { AlertTriangle, Loader2, MessageSquare, Plus, Trash2, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface SessionSidebarProps {
    isOpen?: boolean;
    onClose?: () => void;
}

export default function SessionSidebar({ isOpen = true, onClose }: SessionSidebarProps) {
    const sessions = useStore((state) => state.sessions);
    const sessionsLoading = useStore((state) => state.sessionsLoading);
    const currentSessionId = useStore((state) => state.currentSessionId);
    const loadSessions = useStore((state) => state.loadSessions);
    const setCurrentSession = useStore((state) => state.setCurrentSession);
    const createNewSession = useStore((state) => state.createNewSession);
    const clearMessages = useStore((state) => state.clearMessages);

    useEffect(() => {
        loadSessions();
    }, [loadSessions]);

    const [deletingSession, setDeletingSession] = useState<string | null>(null);

    const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeletingSession(sessionId);
    };

    const confirmDelete = async (sessionId: string) => {
        try {
            await deleteSession(sessionId);
            toast.success('Session deleted');
            if (sessionId === currentSessionId) {
                createNewSession();
            }
            loadSessions();
        } catch (error) {
            toast.error(`Failed to delete session: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setDeletingSession(null);
        }
    };

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 lg:hidden"
                    onClick={onClose}
                    aria-hidden="true"
                />
            )}

            {/* Sidebar */}
            <div className={`
                fixed lg:static inset-y-0 left-0 z-50
                w-72 lg:w-64 border-r border-gray-700 bg-[#202123] 
                flex flex-col shrink-0
                transform transition-transform duration-300 ease-in-out
                ${isOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
                shadow-xl lg:shadow-none
                h-screen lg:h-auto
            `}>
                {/* Header with close button for mobile */}
                <div className="p-4 border-b border-gray-700 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <MessageSquare className="w-5 h-5 text-[#10a37f]" />
                        <h2 className="text-lg font-semibold text-gray-200">Chats</h2>
                    </div>
                    {onClose && (
                        <button
                            onClick={onClose}
                            className="lg:hidden p-1.5 hover:bg-[#343541] rounded-lg transition-colors"
                            aria-label="Close sidebar"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    )}
                </div>

                {/* New Chat Button */}
                <div className="p-3 border-b border-gray-700">
                    <button
                        onClick={createNewSession}
                        className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-[#10a37f] font-medium text-sm shadow-md hover:shadow-lg active:scale-95"
                        aria-label="Create new session"
                    >
                        <Plus className="w-4 h-4" aria-hidden="true" />
                        <span>New chat</span>
                    </button>
                </div>

                {/* Sessions List */}
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                    {sessionsLoading ? (
                        <div className="flex items-center justify-center py-12">
                            <Loader2 className="w-6 h-6 animate-spin text-[#10a37f]" />
                        </div>
                    ) : sessions.length === 0 ? (
                        <div className="text-center py-12 px-4">
                            <MessageSquare className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                            <p className="text-sm text-gray-500">No conversations yet</p>
                            <p className="text-xs text-gray-600 mt-1">Start a new chat to begin</p>
                        </div>
                    ) : (
                        sessions.map((session) => (
                            <div
                                key={session.session_id}
                                onClick={() => {
                                    if (session.session_id !== currentSessionId) {
                                        setCurrentSession(session.session_id);
                                        onClose?.();
                                    }
                                }}
                                onKeyDown={(e) => {
                                    if ((e.key === 'Enter' || e.key === ' ') && session.session_id !== currentSessionId) {
                                        e.preventDefault();
                                        setCurrentSession(session.session_id);
                                        onClose?.();
                                    }
                                }}
                                tabIndex={0}
                                role="button"
                                aria-label={`Switch to session ${session.session_id === 'default' ? 'Default' : session.session_id}`}
                                className={`group flex items-center justify-between p-3 rounded-lg cursor-pointer transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-[#10a37f] ${session.session_id === currentSessionId
                                    ? 'bg-[#343541] text-white shadow-md'
                                    : 'hover:bg-[#2d2d2f] text-gray-300'
                                    }`}
                            >
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <MessageSquare className={`w-4 h-4 shrink-0 ${session.session_id === currentSessionId ? 'text-[#10a37f]' : 'text-gray-500'}`} />
                                    <div className="flex-1 min-w-0">
                                        <div className="text-sm font-medium truncate">
                                            {session.session_id === 'default' ? 'Default' : session.session_id}
                                        </div>
                                        <div className="text-xs text-gray-500 mt-0.5">
                                            {session.message_count} {session.message_count === 1 ? 'message' : 'messages'}
                                        </div>
                                    </div>
                                </div>
                                <button
                                    onClick={(e) => handleDeleteSession(session.session_id, e)}
                                    className="ml-2 p-1.5 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 rounded-lg transition-all focus:outline-none focus:ring-2 focus:ring-red-500"
                                    aria-label={`Delete session ${session.session_id === 'default' ? 'Default' : session.session_id}`}
                                >
                                    <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" aria-hidden="true" />
                                </button>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-700">
                    <div className="text-xs text-gray-500 mb-1">Current session</div>
                    <div className="text-sm font-medium text-gray-300 truncate">
                        {currentSessionId === 'default' ? 'Default' : currentSessionId}
                    </div>
                </div>
            </div>

            {/* Delete Confirmation Modal */}
            {deletingSession && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#343541] rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-200">Delete Session</h3>
                            </div>
                            <p className="text-gray-300 mb-6">
                                Are you sure you want to delete <span className="font-medium text-white">{deletingSession === 'default' ? 'Default' : deletingSession}</span>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setDeletingSession(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#40414f] rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => confirmDelete(deletingSession)}
                                    className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}

