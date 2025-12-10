import React, { useEffect, useState, useMemo } from 'react';
import { Activity as ActivityIcon, Clock, CheckCircle, AlertCircle, Sparkles, Loader2, ChevronLeft, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import { getSystemActivity } from '@/lib/api/admin';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

const ITEMS_PER_PAGE = 20;

export default function ActivityView() {
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    useEffect(() => {
        const loadActivity = async () => {
            try {
                const data = await getSystemActivity(100).catch(() => []);
                setActivities(data || []);
            } catch (error) {
                console.error("Failed to load activity", error);
            } finally {
                setLoading(false);
            }
        };
        loadActivity();
    }, []);

    const totalPages = Math.ceil(activities.length / ITEMS_PER_PAGE);
    const paginatedActivities = useMemo(() => {
        const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
        return activities.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    }, [activities, currentPage]);

    if (loading) {
        return <div className="p-12 text-center text-zinc-500 flex flex-col items-center"><Loader2 className="w-8 h-8 animate-spin mb-2" />Loading activity log...</div>;
    }

    return (
        <div className="space-y-6 h-full flex flex-col">
            <div className="flex items-center gap-4 flex-shrink-0">
                <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                    <ActivityIcon className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">System Activity</h2>
                    <p className="text-zinc-400 text-sm">Real-time log of important system events.</p>
                </div>
            </div>

            <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl overflow-hidden relative flex-1 flex flex-col min-h-0">
                <div className="absolute top-0 right-0 p-32 bg-purple-500/5 rounded-full blur-3xl pointer-events-none" />

                <div className="flex-1 overflow-y-auto scrollbar-thin scrollbar-thumb-zinc-700 scrollbar-track-transparent divide-y divide-white/5 relative z-10 min-h-0">
                    {activities.length === 0 && (
                        <div className="p-8 text-center text-zinc-500">No recent activity found.</div>
                    )}
                    {paginatedActivities.map((activity, index) => (
                        <motion.div
                            key={activity.id}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="p-6 hover:bg-white/[0.02] transition-colors flex items-center justify-between group"
                        >
                            <div className="flex items-center gap-5">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center border ${activity.status === 'success' ? 'bg-green-500/10 text-green-400 border-green-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20'}`}>
                                    {activity.status === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-white flex items-center gap-2">
                                        {activity.action}
                                        {activity.status === 'success' && <Sparkles className="w-3 h-3 text-yellow-400 opacity-0 group-hover:opacity-100 transition-opacity" />}
                                    </p>
                                    <p className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                                        <span className="w-1.5 h-1.5 rounded-full bg-zinc-700" />
                                        by <span className="text-zinc-300">{activity.user}</span>
                                        <span className="text-zinc-600 px-1">•</span>
                                        <span className="text-zinc-500">{activity.details}</span>
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-zinc-500 font-mono bg-black/20 px-3 py-1.5 rounded-full border border-white/5">
                                <Clock className="w-3 h-3" />
                                {activity.time ? formatDistanceToNow(new Date(activity.time), { addSuffix: true }) : 'Unknown'}
                            </div>
                        </motion.div>
                    ))}
                </div>

                {/* Pagination */}
                {activities.length > ITEMS_PER_PAGE && (
                    <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-white/[0.01] flex-shrink-0">
                        <div className="text-sm text-zinc-400">
                            Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to {Math.min(currentPage * ITEMS_PER_PAGE, activities.length)} of {activities.length} activities
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
                                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                                    let page;
                                    if (totalPages <= 5) {
                                        page = i + 1;
                                    } else if (currentPage <= 3) {
                                        page = i + 1;
                                    } else if (currentPage >= totalPages - 2) {
                                        page = totalPages - 4 + i;
                                    } else {
                                        page = currentPage - 2 + i;
                                    }
                                    return (
                                        <button
                                            key={page}
                                            onClick={() => setCurrentPage(page)}
                                            className={cn(
                                                "w-8 h-8 rounded-lg text-sm font-medium transition-colors",
                                                currentPage === page
                                                    ? "bg-purple-500 text-white"
                                                    : "text-zinc-400 hover:text-white hover:bg-white/5"
                                            )}
                                        >
                                            {page}
                                        </button>
                                    );
                                })}
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
        </div>
    );
}
