"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { Loader2, LayoutDashboard, Activity, Settings, MessageSquare, TrendingUp } from "lucide-react";
import UserStatsView from "@/components/dashboard/UserStatsView";
import { listSessions } from "@/lib/api/sessions";
import { getUsageStats, getIndividualRequests, type IndividualRequest } from "@/lib/api/monitoring";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import Link from "next/link";
import NotificationsPopover from "@/components/admin/NotificationsPopover";

export default function UserDashboard() {
  const router = useRouter();
  const { user, isAuthenticated, authLoading } = useStore();
  const [activeTab, setActiveTab] = useState<'overview' | 'activity' | 'monitoring' | 'settings'>('overview');
  const [sessions, setSessions] = useState<any[]>([]);
  const [recentRequests, setRecentRequests] = useState<IndividualRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [sessionsLoading, setSessionsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/auth/login");
      return;
    }

    if (isAuthenticated && user) {
      loadDashboardData();
    }
  }, [isAuthenticated, authLoading, user, router]);

  const loadDashboardData = async () => {
    const { accountInactive, user } = useStore.getState();
    // Don't load data if account is inactive
    if (accountInactive || (user && !user.is_active)) {
      setSessions([]);
      setRecentRequests([]);
      setLoading(false);
      setSessionsLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      // Load sessions
      setSessionsLoading(true);
      try {
        const sessionsData = await listSessions();
        setSessions(sessionsData.sessions || []);
      } catch (error: any) {
        // Don't log errors for inactive accounts
        if (!error?.isInactiveAccount && !(error?.message && error.message.includes("User account is inactive"))) {
          console.error("Failed to load sessions:", error);
        }
      } finally {
        setSessionsLoading(false);
      }

      // Load recent requests
      try {
        const requestsData = await getIndividualRequests(7, 20, 0);
        setRecentRequests(requestsData.requests || []);
      } catch (error: any) {
        // Don't log errors for inactive accounts
        if (!error?.isInactiveAccount && !(error?.message && error.message.includes("User account is inactive"))) {
          console.error("Failed to load recent requests:", error);
        }
      }

    } catch (error: any) {
      // Don't log errors for inactive accounts
      if (!error?.isInactiveAccount && !(error?.message && error.message.includes("User account is inactive"))) {
        console.error("Failed to load dashboard data:", error);
      }
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  const tabs = [
    { id: 'overview' as const, label: 'Overview', icon: LayoutDashboard },
    { id: 'activity' as const, label: 'My Activity', icon: Activity },
    { id: 'monitoring' as const, label: 'Monitoring', icon: TrendingUp },
    { id: 'settings' as const, label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      {/* Header */}
      <div className="border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                <LayoutDashboard className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">My Dashboard</h1>
                <p className="text-sm text-zinc-400">Welcome back, {user.name}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <NotificationsPopover />
              <Link
                href="/chat"
                className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <MessageSquare className="w-4 h-4" />
                Go to Chat
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-zinc-800 bg-zinc-900/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex gap-1 overflow-x-auto scrollbar-hide">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap",
                    activeTab === tab.id
                      ? "border-indigo-500 text-indigo-400"
                      : "border-transparent text-zinc-400 hover:text-white"
                  )}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <UserStatsView />
          </div>
        )}

        {activeTab === 'activity' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400">
                  <Activity className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Recent Sessions</h2>
                  <p className="text-sm text-zinc-400">Your conversation history</p>
                </div>
              </div>

              {sessionsLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
              ) : sessions.length > 0 ? (
                <div className="space-y-3">
                  {sessions.slice(0, 10).map((session) => (
                    <Link
                      key={session.session_id}
                      href={`/chat?session=${session.session_id}`}
                      className="block p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg hover:border-indigo-500/50 hover:bg-zinc-900/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="text-white font-medium mb-1">
                            {session.title || `Session ${session.session_id.slice(-8)}`}
                          </h3>
                          {session.summary && (
                            <p className="text-sm text-zinc-400 mb-2 line-clamp-2">{session.summary}</p>
                          )}
                          <div className="flex items-center gap-4 text-xs text-zinc-500">
                            <span>{session.message_count || 0} messages</span>
                            {session.updated_at && (
                              <span>{format(new Date(session.updated_at), "MMM d, yyyy 'at' h:mm a")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No sessions yet. Start a conversation in the chat!</p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Recent Requests</h2>
                  <p className="text-sm text-zinc-400">Your recent API requests</p>
                </div>
              </div>

              {recentRequests.length > 0 ? (
                <div className="space-y-3">
                  {recentRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={cn(
                              "px-2 py-0.5 text-xs rounded-full",
                              request.success
                                ? "bg-green-500/10 text-green-400"
                                : "bg-red-500/10 text-red-400"
                            )}>
                              {request.success ? "Success" : "Failed"}
                            </span>
                            {request.llm_provider && (
                              <span className="text-xs text-zinc-400">
                                {request.llm_provider} / {request.llm_model}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                            <span>{request.total_tokens.toLocaleString()} tokens</span>
                            {request.request_timestamp && (
                              <span>{format(new Date(request.request_timestamp), "MMM d, yyyy 'at' h:mm a")}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-500">
                  <TrendingUp className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>No recent requests</p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'monitoring' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                    <TrendingUp className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-semibold text-white">Usage Monitoring</h2>
                    <p className="text-sm text-zinc-400">Detailed usage analytics and statistics</p>
                  </div>
                </div>
                <Link
                  href="/monitoring"
                  className="px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors text-sm"
                >
                  View Full Monitoring
                </Link>
              </div>
              <p className="text-zinc-400 text-sm">
                For detailed usage monitoring, charts, and analytics, visit the{" "}
                <Link href="/monitoring" className="text-indigo-400 hover:text-indigo-300 underline">
                  full monitoring page
                </Link>
                .
              </p>
            </div>
          </div>
        )}

        {activeTab === 'settings' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                  <Settings className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-white">Settings</h2>
                  <p className="text-sm text-zinc-400">Manage your account settings</p>
                </div>
              </div>
              <div className="space-y-4">
                <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Account Information</h3>
                  <div className="space-y-2 text-sm text-zinc-400">
                    <div className="flex justify-between">
                      <span>Name:</span>
                      <span className="text-white">{user.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Email:</span>
                      <span className="text-white">{user.email}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Role:</span>
                      <span className={cn(
                        "px-2 py-0.5 rounded text-xs",
                        user.role === 'superadmin' ? "bg-purple-500/10 text-purple-400" :
                        user.role === 'admin' ? "bg-blue-500/10 text-blue-400" :
                        "bg-zinc-500/10 text-zinc-400"
                      )}>
                        {user.role || 'user'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-zinc-950/50 border border-zinc-800 rounded-lg">
                  <h3 className="text-white font-medium mb-2">Quick Links</h3>
                  <div className="space-y-2">
                    <Link
                      href="/monitoring"
                      className="block text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      → Usage Monitoring
                    </Link>
                    <Link
                      href="/chat"
                      className="block text-sm text-indigo-400 hover:text-indigo-300"
                    >
                      → Chat Interface
                    </Link>
                    {(user.role === 'admin' || user.role === 'superadmin') && (
                      <Link
                        href="/admin"
                        className="block text-sm text-indigo-400 hover:text-indigo-300"
                      >
                        → {user.role === 'superadmin' ? 'SuperAdmin' : 'Admin'} Dashboard
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

