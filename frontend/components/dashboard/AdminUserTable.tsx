import React, { useEffect, useState } from 'react';
import { Loader2, Shield, User as UserIcon, Ban, CheckCircle, Search, LogIn, ShieldOff } from 'lucide-react';
import { listUsers, blockUser, unblockUser, AdminUser } from '@/lib/api/admin';
import { useStore } from '@/lib/store';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';

export default function AdminUserTable() {
    const [loading, setLoading] = useState(true);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [search, setSearch] = useState("");
    const [processingId, setProcessingId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);
    
    const user = useStore(state => state.user);
    const impersonatedUserId = useStore(state => state.impersonatedUserId);
    const isSuperAdmin = useStore(state => state.isSuperadmin());
    const getActualUserRole = useStore(state => state.getActualUserRole);
    
    // Check actual logged-in user's role (not impersonated user's role)
    const actualUserRole = getActualUserRole();
    const isAdmin = actualUserRole === 'admin';
    // Superadmin can always access admin features, even when impersonating
    const canAccessAdmin = isSuperAdmin || isAdmin;

    const loadUsers = async () => {
        // Only load admin data if user has admin/superadmin access
        if (!canAccessAdmin) {
            setError("Admin access is not available");
            setLoading(false);
            return;
        }

        try {
            setError(null);
            const data = await listUsers();
            setUsers(data);
        } catch (error: any) {
            // Check if this is a permission error during impersonation
            const isPermissionError = error?.isPermissionError || 
                error?.message?.includes("Superadmin") || 
                error?.detail?.includes("Superadmin") ||
                error?.message?.includes("access") ||
                error?.detail?.includes("access");
            
            // Only log non-permission errors
            if (!isPermissionError) {
            console.error("Failed to list users:", error);
            }
            
            const errorMessage = error?.message || error?.detail || "Failed to load users";
            setError(errorMessage);
            
            // Only show toast for unexpected errors, not permission errors
            if (!isPermissionError) {
                toast.error(errorMessage);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadUsers();
    }, [canAccessAdmin]);

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

    const filteredUsers = users.filter(user =>
        user.name.toLowerCase().includes(search.toLowerCase()) ||
        user.email.toLowerCase().includes(search.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                    <div className="p-4 bg-red-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <ShieldOff className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Admin Access Unavailable</h3>
                    <p className="text-sm text-zinc-400">
                        {error}
                    </p>
                    {!canAccessAdmin && (
                        <p className="text-xs text-zinc-500 mt-2">
                            Exit persistent access to view admin features.
                        </p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl overflow-hidden">
            <div className="p-4 border-b border-zinc-800 flex items-center justify-between gap-4">
                <div>
                    <h3 className="text-white font-medium">User Management</h3>
                    {isAdmin && !isSuperAdmin && (
                        <p className="text-xs text-zinc-500 mt-1">View only - Admin access</p>
                    )}
                </div>
                <div className="relative">
                    <Search className="w-4 h-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                        type="text"
                        placeholder="Search users..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="bg-zinc-950 border border-zinc-800 rounded-lg pl-9 pr-3 py-1.5 text-sm text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50 w-64"
                    />
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="bg-zinc-950/50 text-zinc-400">
                        <tr>
                            <th className="px-4 py-3 font-medium">User</th>
                            <th className="px-4 py-3 font-medium">Role</th>
                            <th className="px-4 py-3 font-medium">Status</th>
                            <th className="px-4 py-3 font-medium">Joined</th>
                            <th className="px-4 py-3 font-medium text-right">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-zinc-800">
                        {filteredUsers.map((user) => (
                            <tr key={user.id} className="hover:bg-zinc-800/30 transition-colors group">
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                                            <UserIcon className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <div className="text-white font-medium">{user.name}</div>
                                            <div className="text-zinc-500 text-xs">{user.email}</div>
                                        </div>
                                    </div>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-xs font-medium inline-flex items-center gap-1",
                                        user.role === 'superadmin'
                                            ? "bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                            : user.role === 'admin'
                                            ? "bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                            : "bg-zinc-800 text-zinc-400"
                                    )}>
                                        {(user.role === 'superadmin' || user.role === 'admin') && <Shield className="w-3 h-3" />}
                                        {user.role}
                                    </span>
                                </td>
                                <td className="px-4 py-3">
                                    <span className={cn(
                                        "px-2 py-0.5 rounded text-xs",
                                        user.is_active
                                            ? "bg-green-500/10 text-green-400"
                                            : "bg-red-500/10 text-red-400"
                                    )}>
                                        {user.is_active ? 'Active' : 'Blocked'}
                                    </span>
                                </td>
                                <td className="px-4 py-3 text-zinc-500 text-xs">
                                    {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                                </td>
                                <td className="px-4 py-3 text-right">
                                    {/* Only superadmin can perform actions */}
                                    {isSuperAdmin && user.role !== 'superadmin' && (
                                        <div className="flex items-center justify-end gap-1">
                                            <button
                                                onClick={() => {
                                                    // Start impersonating
                                                    const { useStore } = require('@/lib/store');
                                                    useStore.getState().setImpersonatedUserId(user.id.toString());
                                                    toast.success(`Switched to ${user.name}`);
                                                }}
                                                className="p-1.5 rounded transition-colors text-zinc-500 hover:text-indigo-400 hover:bg-indigo-500/10"
                                                title={`Switch to ${user.name}`}
                                            >
                                                <LogIn className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleToggleBlock(user)}
                                                disabled={processingId === user.id}
                                                className={cn(
                                                    "p-1.5 rounded transition-colors disabled:opacity-50",
                                                    user.is_active
                                                        ? "text-zinc-500 hover:text-red-400 hover:bg-red-500/10"
                                                        : "text-zinc-500 hover:text-green-400 hover:bg-green-500/10"
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
                                    {/* Admin can only view, no actions */}
                                    {isAdmin && (
                                        <div className="text-zinc-500 text-xs">
                                            View Only
                                        </div>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>

                {filteredUsers.length === 0 && (
                    <div className="text-center py-12 text-zinc-500">
                        No users found.
                    </div>
                )}
            </div>
        </div>
    );
}
