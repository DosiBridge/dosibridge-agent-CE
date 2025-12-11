import React, { useEffect, useState } from 'react';
import { Loader2, Users, MessageSquare, FileText, Server, TrendingUp, Lock, Activity, Zap, ShieldOff } from 'lucide-react';
import { getSystemStats, getSystemUsageHistory, SystemStats, SystemUsageHistory } from '@/lib/api/admin';
import { useStore } from '@/lib/store';
import toast from 'react-hot-toast';
import {
    Area,
    AreaChart,
    CartesianGrid,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer
} from "recharts";

export default function AdminStatsView() {
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [history, setHistory] = useState<SystemUsageHistory | null>(null);
    const [days, setDays] = useState(7);
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

    useEffect(() => {
        // Only load admin data if user has admin/superadmin access
        if (!canAccessAdmin) {
            setError("Admin access is not available");
            setLoading(false);
            return;
        }

        const fetchData = async () => {
            try {
                setError(null);
                const [statsData, historyData] = await Promise.all([
                    getSystemStats(),
                    getSystemUsageHistory(days)
                ]);
                setStats(statsData);
                setHistory(historyData);
            } catch (error: any) {
                // Check if this is a permission error during impersonation
                const isPermissionError = error?.isPermissionError || 
                    error?.message?.includes("Superadmin") || 
                    error?.detail?.includes("Superadmin") ||
                    error?.message?.includes("access") ||
                    error?.detail?.includes("access");
                
                // Only log non-permission errors
                if (!isPermissionError) {
                console.error("Failed to load admin dashboard data:", error);
                }
                
                const errorMessage = error?.message || error?.detail || "Failed to load dashboard data";
                setError(errorMessage);
                
                // Only show toast for unexpected errors, not permission errors
                if (!isPermissionError) {
                    toast.error(errorMessage);
                }
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [days, canAccessAdmin]);

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="flex items-center justify-center p-12">
                <div className="text-center max-w-md">
                    <div className="p-4 bg-red-500/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                        <ShieldOff className="w-8 h-8 text-red-400" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">Admin Access Unavailable</h3>
                    <p className="text-sm text-zinc-400">
                        {error || "Failed to load admin dashboard data. Admin features require superadmin access."}
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
        <div className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">Total Users</p>
                            <p className="text-2xl font-bold text-white">{stats.total_users}</p>
                        </div>
                        <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                            <Users className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">Active Users</p>
                            <p className="text-2xl font-bold text-emerald-500">{stats.active_users}</p>
                        </div>
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <TrendingUp className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">Blocked Users</p>
                            <p className="text-2xl font-bold text-red-500">{stats.blocked_users}</p>
                        </div>
                        <div className="p-2 bg-red-500/10 rounded-lg text-red-400">
                            <Lock className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">Total Conversations</p>
                            <p className="text-2xl font-bold text-white">{stats.total_conversations}</p>
                        </div>
                        <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                            <MessageSquare className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">Documents</p>
                            <p className="text-2xl font-bold text-white">{stats.total_documents}</p>
                        </div>
                        <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                            <FileText className="w-6 h-6" />
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                    <div className="flex items-center justify-between">
                        <div>
                            <p className="text-sm text-zinc-400 mb-1">MCP Servers</p>
                            <p className="text-2xl font-bold text-white">{stats.total_mcp_servers}</p>
                        </div>
                        <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400">
                            <Server className="w-6 h-6" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Charts */}
            {history && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Activity Chart */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Activity className="w-5 h-5 text-indigo-400" />
                                System Activity
                            </h3>
                            <select
                                value={days}
                                onChange={(e) => setDays(Number(e.target.value))}
                                className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-sm text-zinc-300"
                            >
                                <option value={7}>Last 7 days</option>
                                <option value={14}>Last 14 days</option>
                                <option value={30}>Last 30 days</option>
                            </select>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history.history}>
                                    <defs>
                                        <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${value}`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e4e4e7' }}
                                        labelStyle={{ color: '#a1a1aa' }}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="requests"
                                        stroke="#6366f1"
                                        fillOpacity={1}
                                        fill="url(#colorRequests)"
                                        name="Requests"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Token Usage Chart */}
                    <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                                <Zap className="w-5 h-5 text-emerald-400" />
                                Token Usage
                            </h3>
                        </div>
                        <div className="h-[300px] w-full">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={history.history}>
                                    <defs>
                                        <linearGradient id="colorTokens" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                                    <XAxis
                                        dataKey="date"
                                        tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                    />
                                    <YAxis
                                        stroke="#71717a"
                                        fontSize={12}
                                        tickLine={false}
                                        axisLine={false}
                                        tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`}
                                    />
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '8px' }}
                                        itemStyle={{ color: '#e4e4e7' }}
                                        labelStyle={{ color: '#a1a1aa' }}
                                        formatter={(value: number) => [value.toLocaleString(), "Tokens"]}
                                    />
                                    <Area
                                        type="monotone"
                                        dataKey="tokens"
                                        stroke="#10b981"
                                        fillOpacity={1}
                                        fill="url(#colorTokens)"
                                        name="Tokens"
                                        strokeWidth={2}
                                    />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
