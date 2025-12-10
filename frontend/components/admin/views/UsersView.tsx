import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Shield, User as UserIcon, Ban, CheckCircle, Search, LogIn, Mail, MoreVertical, ChevronLeft, ChevronRight } from 'lucide-react';
import { listUsers, blockUser, unblockUser, AdminUser } from '@/lib/api/admin';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import UserInspector from '../UserInspector';

const ITEMS_PER_PAGE = 10;

export default function UsersView() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [inspectingUserId, setInspectingUserId] = useState<number | null>(null);
    const [currentPage, setCurrentPage] = useState(1);

    const loadUsers = async () => {
        try {
            const data = await listUsers();
            setUsers(data);
        } catch (error) {
            console.error("Failed to list users:", error);
            toast.error("Failed to load users");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, []);

    const handleToggleBlock = async (user: AdminUser) => {
        if (user.role === 'superadmin') {
            toast.error("Cannot block superadmin users");
            return;
        }

        if (!confirm(`Are you sure you want to ${user.is_active ? 'block' : 'unblock'} ${user.name}?`)) {
            return;
        }

        setProcessingId(user.id);
        try {
            if (user.is_active) {
                await blockUser(user.id);
                toast.success("User blocked");
            } else {
                await unblockUser(user.id);
                toast.success("User unblocked");
            }
            await loadUsers();
        } catch (error) {
            toast.error("Failed to update user status");
        } finally {
            setProcessingId(null);
        }
    };

    const filteredUsers = useMemo(() => {
        return users.filter(user =>
            user.name.toLowerCase().includes(search.toLowerCase()) ||
            user.email.toLowerCase().includes(search.toLowerCase())
        );
    }, [users, search]);

    const totalPages = Math.ceil(filteredUsers.length / ITEMS_PER_PAGE);
    const paginatedUsers = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return filteredUsers.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [filteredUsers, currentPage]);

    useEffect(() => {
        setCurrentPage(1); // Reset to first page when search changes
    }, [search]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-zinc-900/50 backdrop-blur-sm border border-white/5 p-6 rounded-3xl">
                <div>
                    <h2 className="text-xl font-bold text-white mb-1">User Management</h2>
                    <p className="text-sm text-zinc-400">Manage access and permissions for {users.length} users</p>
                </div>
                <div className="relative w-full sm:w-auto">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full sm:w-72 bg-black/20 border border-white/10 rounded-full pl-10 pr-4 py-2.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all placeholder-zinc-600 hover:bg-black/40"
                    />
                </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden shadow-xl">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-white/[0.02] border-b border-white/5">
                            <tr>
                                <th className="px-6 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">User</th>
                                <th className="px-6 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Role</th>
                                <th className="px-6 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Status</th>
                                <th className="px-6 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-wider">Joined</th>
                                <th className="px-6 py-5 text-xs font-semibold text-zinc-400 uppercase tracking-wider text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            <AnimatePresence>
                                {paginatedUsers.map((user) => (
                                    <motion.tr
                                        key={user.id}
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="hover:bg-white/[0.02] transition-colors group"
                                    >
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-4">
                                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center text-white font-bold shadow-lg shadow-indigo-500/20 border border-white/10">
                                                    {user.name[0].toUpperCase()}
                                                </div>
                                                <div>
                                                    <div className="font-semibold text-white">{user.name}</div>
                                                    <div className="text-zinc-500 text-xs flex items-center gap-1">
                                                        <Mail className="w-3 h-3" />
                                                        {user.email}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 transition-colors border",
                                                user.role === 'superadmin'
                                                    ? "bg-purple-500/10 text-purple-400 border-purple-500/20"
                                                    : "bg-zinc-800 text-zinc-400 border-zinc-700"
                                            )}>
                                                {user.role === 'superadmin' && <Shield className="w-3 h-3" />}
                                                {user.role}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className={cn(
                                                "px-3 py-1 rounded-full text-xs font-medium inline-flex items-center gap-1.5 border",
                                                user.is_active
                                                    ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                    : "bg-red-500/10 text-red-400 border-red-500/20"
                                            )}>
                                                <div className={cn("w-1.5 h-1.5 rounded-full", user.is_active ? 'bg-green-400' : 'bg-red-400')} />
                                                {user.is_active ? 'Active' : 'Blocked'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-zinc-500 text-xs font-mono">
                                            {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            {user.role !== 'superadmin' && (
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                                                    <button
                                                        onClick={() => {
                                                            const { useStore } = require('@/lib/store');
                                                            useStore.getState().setImpersonatedUserId(user.id.toString());
                                                            toast.success(`Switched to ${user.name}`);
                                                        }}
                                                        className="p-2 rounded-lg transition-colors text-zinc-400 hover:text-indigo-400 hover:bg-indigo-500/10 border border-transparent hover:border-indigo-500/20"
                                                        title={`Switch to ${user.name}`}
                                                    >
                                                        <LogIn className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => setInspectingUserId(user.id)}
                                                        className="p-2 rounded-lg transition-colors text-zinc-400 hover:text-blue-400 hover:bg-blue-500/10 border border-transparent hover:border-blue-500/20"
                                                        title="Inspect User Details"
                                                    >
                                                        <MoreVertical className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => handleToggleBlock(user)}
                                                        disabled={processingId === user.id}
                                                        className={cn(
                                                            "p-2 rounded-lg transition-colors disabled:opacity-50 border border-transparent",
                                                            user.is_active
                                                                ? "text-zinc-400 hover:text-red-400 hover:bg-red-500/10 hover:border-red-500/20"
                                                                : "text-zinc-400 hover:text-green-400 hover:bg-green-500/10 hover:border-green-500/20"
                                                        )}
                                                        title={user.is_active ? "Block User" : "Unblock User"}
                                                    >
                                                        {processingId === user.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : user.is_active ? (
                                                            <Ban className="w-4 h-4" />
                                                        ) : (
                                                            <CheckCircle className="w-4 h-4" />
                                                        )}
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </motion.tr>
                                ))}
                            </AnimatePresence>
                        </tbody>
                    </table>

                    {filteredUsers.length === 0 && (
                        <div className="text-center py-20 text-zinc-500">
                            No users found matching your search.
                        </div>
                    )}
                </div>

                {/* Pagination */}
                {filteredUsers.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.01]">
                        <div className="text-sm text-zinc-400">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, filteredUsers.length)} of {filteredUsers.length} users
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1",
                                    currentPage === 1
                                        ? "text-zinc-600 cursor-not-allowed"
                                        : "text-zinc-300 hover:text-white hover:bg-white/5"
                                )}
                            >
                                <ChevronLeft className="w-4 h-4" />
                                Previous
                            </button>
                            <div className="flex items-center gap-1">
                                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                                    <button
                                        key={page}
                                        onClick={() => setCurrentPage(page)}
                                        className={cn(
                                            "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                                            currentPage === page
                                                ? "bg-indigo-500 text-white"
                                                : "text-zinc-400 hover:text-white hover:bg-white/5"
                                        )}
                                    >
                                        {page}
                                    </button>
                                ))}
                            </div>
                            <button
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className={cn(
                                    "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-1",
                                    currentPage === totalPages
                                        ? "text-zinc-600 cursor-not-allowed"
                                        : "text-zinc-300 hover:text-white hover:bg-white/5"
                                )}
                            >
                                Next
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}
            </div>

            <AnimatePresence>
                {inspectingUserId && (
                    <UserInspector
                        userId={inspectingUserId}
                        onClose={() => setInspectingUserId(null)}
                        onRefetch={loadUsers}
                    />
                )}
            </AnimatePresence>
        </div>
    );
}
