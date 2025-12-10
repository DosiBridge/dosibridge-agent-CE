import React, { useEffect, useState } from 'react';
import {
    Users,
    TrendingUp,
    Lock,
    MessageSquare,
    FileText,
    Server,
    ArrowUpRight,
    ArrowDownRight,
    Activity,
    CreditCard,
    PieChart as PieChartIcon,
    BarChart as BarChartIcon
} from 'lucide-react';
import { getSystemStats, SystemStats, getUsageAnalytics, getModelAnalytics, getTopUsersAnalytics } from '@/lib/api/admin';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend,
    BarChart, Bar
} from 'recharts';

const COLORS = ['#818cf8', '#34d399', '#f472b6', '#fbbf24', '#60a5fa'];

export default function AnalyticsView() {
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [usageData, setUsageData] = useState<any[]>([]);
    const [modelData, setModelData] = useState<any[]>([]);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const loadStats = async () => {
            try {
                setError(null);
                const [data, usage, models, users] = await Promise.all([
                    getSystemStats(),
                    getUsageAnalytics(30).catch(() => []),
                    getModelAnalytics(30).catch(() => []),
                    getTopUsersAnalytics(5, 30).catch(() => [])
                ]);
                setStats(data);
                setUsageData(usage || []);
                setModelData(models || []);
                setTopUsers(users || []);
            } catch (error: any) {
                console.error("Failed to load stats:", error);
                setError(error?.message || "Failed to load analytics data");
            } finally {
                setLoading(false);
            }
        };
        loadStats();
    }, []);

    if (loading) {
        return (
            <div className="p-8 text-center text-zinc-500 flex flex-col items-center justify-center min-h-[400px]">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
                <p>Loading analytics...</p>
            </div>
        );
    }

    if (error || !stats) {
        return (
            <div className="p-8 text-center text-red-400 flex flex-col items-center justify-center min-h-[400px]">
                <p className="text-lg font-semibold mb-2">Failed to load analytics data</p>
                <p className="text-sm text-zinc-500">{error || "Unknown error occurred"}</p>
            </div>
        );
    }

    const StatCard = ({ title, value, icon: Icon, color, trend, className, delay = 0 }: any) => (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay }}
            className={cn(
                "bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 relative overflow-hidden group hover:border-white/10 transition-all duration-500",
                className
            )}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <div className="relative z-10">
                <div className="flex items-center justify-between mb-8">
                    <div className={cn("p-3 rounded-2xl bg-white/5 border border-white/5", color)}>
                        <Icon className="w-6 h-6" />
                    </div>
                    {trend && (
                        <div className={cn("flex items-center gap-1 text-sm font-medium px-2 py-1 rounded-full bg-white/5 border border-white/5", trend > 0 ? 'text-green-400' : 'text-red-400')}>
                            {trend > 0 ? <ArrowUpRight className="w-4 h-4" /> : <ArrowDownRight className="w-4 h-4" />}
                            {Math.abs(trend)}%
                        </div>
                    )}
                </div>
                <div>
                    <h3 className="text-4xl font-bold text-white mb-2 tracking-tight">{value}</h3>
                    <p className="text-sm text-zinc-400 font-medium">{title}</p>
                </div>
            </div>

            {/* Decorative background glow */}
            <div className={cn("absolute -bottom-10 -right-10 w-32 h-32 rounded-full blur-3xl opacity-20 pointer-events-none transition-opacity duration-500 group-hover:opacity-40", color.replace('text-', 'bg-'))} />
        </motion.div>
    );

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-zinc-900 border border-white/10 p-3 rounded-xl shadow-xl z-50">
                    <p className="text-zinc-400 text-xs mb-1">{label}</p>
                    {payload.map((entry: any, index: number) => (
                        <p key={index} className="text-sm font-medium" style={{ color: entry.color }}>
                            {entry.name}: {entry.value.toLocaleString()}
                        </p>
                    ))}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <StatCard
                    title="Total Users"
                    value={stats.total_users}
                    icon={Users}
                    color="text-blue-400"
                    className="md:col-span-2"
                    delay={0.1}
                />
                <StatCard
                    title="Active Users"
                    value={stats.active_users}
                    icon={TrendingUp}
                    color="text-green-400"
                    delay={0.2}
                />
                <StatCard
                    title="Blocked Users"
                    value={stats.blocked_users}
                    icon={Lock}
                    color="text-red-400"
                    delay={0.3}
                />
                <StatCard
                    title="Conversations"
                    value={stats.total_conversations}
                    icon={MessageSquare}
                    color="text-purple-400"
                    delay={0.4}
                />
                <StatCard
                    title="Documents Processed"
                    value={stats.total_documents}
                    icon={FileText}
                    color="text-orange-400"
                    className="md:col-span-2"
                    delay={0.5}
                />
                <StatCard
                    title="Active MCP Servers"
                    value={stats.total_mcp_servers}
                    icon={Server}
                    color="text-cyan-400"
                    delay={0.6}
                />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-4">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.7 }}
                    className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8 h-96 flex flex-col justify-between group hover:border-white/10 transition-all duration-500"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">Token Cost Analysis</h3>
                        <div className="p-2 rounded-xl bg-white/5">
                            <CreditCard className="w-5 h-5 text-zinc-400" />
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-0">
                        {usageData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                                No usage data available
                            </div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={usageData}>
                                <defs>
                                        <linearGradient id="colorInput" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="colorOutput" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                                    <Area type="monotone" stackId="1" dataKey="input_tokens" name="Input Tokens" stroke="#34d399" strokeWidth={2} fillOpacity={1} fill="url(#colorInput)" />
                                    <Area type="monotone" stackId="1" dataKey="output_tokens" name="Output Tokens" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorOutput)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.8 }}
                    className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8 h-96 flex flex-col justify-between group hover:border-white/10 transition-all duration-500"
                >
                    <div className="flex items-center justify-between mb-6">
                        <h3 className="text-xl font-bold text-white">API Requests Trend</h3>
                        <div className="p-2 rounded-xl bg-white/5">
                            <Activity className="w-5 h-5 text-zinc-400" />
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-0">
                        {usageData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                                No request data available
                            </div>
                        ) : (
                        <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={usageData}>
                                <defs>
                                    <linearGradient id="colorRequests" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                <XAxis dataKey="date" hide />
                                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 2 }} />
                                    <Area type="monotone" dataKey="requests" name="Total Requests" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorRequests)" />
                            </AreaChart>
                        </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>

            {/* Secondary Charts Row */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                {/* Model Distribution */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.9 }}
                    className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 h-80 flex flex-col group hover:border-white/10 transition-all duration-500 lg:col-span-1"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Model Usage</h3>
                        <div className="p-2 rounded-xl bg-white/5">
                            <PieChartIcon className="w-5 h-5 text-zinc-400" />
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-0 text-xs">
                        {modelData.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                                No model usage data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie
                                        data={modelData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={80}
                                        paddingAngle={5}
                                        dataKey="value"
                                    >
                                        {modelData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>

                {/* Top Users */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 1.0 }}
                    className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-6 h-80 flex flex-col group hover:border-white/10 transition-all duration-500 lg:col-span-2"
                >
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-white">Top Users (by Token Consumption)</h3>
                        <div className="p-2 rounded-xl bg-white/5">
                            <BarChartIcon className="w-5 h-5 text-zinc-400" />
                        </div>
                    </div>
                    <div className="flex-1 w-full h-full min-h-0 text-xs">
                        {topUsers.length === 0 ? (
                            <div className="flex items-center justify-center h-full text-zinc-500 text-sm">
                                No user data available
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={topUsers} layout="vertical" margin={{ left: 40, right: 20 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" horizontal={false} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="name" type="category" width={100} tick={{ fill: '#a1a1aa' }} />
                                    <Tooltip
                                        cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                                        contentStyle={{ backgroundColor: '#18181b', borderColor: 'rgba(255,255,255,0.1)', borderRadius: '12px' }}
                                        itemStyle={{ color: '#fff' }}
                                    />
                                    <Bar dataKey="tokens" name="Total Tokens" fill="#fbbf24" radius={[0, 4, 4, 0]} barSize={20} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </div>
                </motion.div>
            </div>
        </div>
    );
}
