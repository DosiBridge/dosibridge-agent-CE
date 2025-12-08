/**
 * Monitoring Page - API Usage and Key Monitoring
 */
"use client";

import { useStore } from "@/lib/store";
import {
  getUsageStats,
  getTodayUsage,
  getAPIKeysInfo,
  type UsageStats,
  type TodayUsage,
  type APIKeysInfo,
} from "@/lib/api/monitoring";
import {
  Activity,
  AlertCircle,
  CheckCircle2,
  Key,
  TrendingUp,
  XCircle,
  Zap,
  BarChart3,
  Calendar,
  Database,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";

export default function MonitoringPage() {
  const router = useRouter();
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [todayUsage, setTodayUsage] = useState<TodayUsage | null>(null);
  const [apiKeysInfo, setApiKeysInfo] = useState<APIKeysInfo | null>(null);
  const [selectedDays, setSelectedDays] = useState(7);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      loadMonitoringData();
    }
  }, [isAuthenticated, authLoading, router, selectedDays]);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      const [stats, today, keys] = await Promise.all([
        getUsageStats(selectedDays),
        getTodayUsage(),
        getAPIKeysInfo(),
      ]);
      setUsageStats(stats);
      setTodayUsage(today);
      setApiKeysInfo(keys);
    } catch (error) {
      console.error("Failed to load monitoring data:", error);
      toast.error("Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-[var(--background)] flex items-center justify-center">
        <div className="text-center">
          <Activity className="w-8 h-8 animate-spin text-[var(--green)] mx-auto mb-4" />
          <p className="text-[var(--text-secondary)]">Loading monitoring data...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect
  }

  const usagePercentage = todayUsage
    ? Math.round((todayUsage.request_count / todayUsage.limit) * 100)
    : 0;
  const isNearLimit = todayUsage ? todayUsage.request_count >= todayUsage.limit * 0.8 : false;

  return (
    <div className="min-h-screen bg-[var(--background)]">
      {/* Header */}
      <header className="border-b border-[var(--border)] bg-[var(--background)]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/chat"
                className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                aria-label="Back to chat"
              >
                <ArrowLeft className="w-5 h-5 text-[var(--text-primary)]" />
              </Link>
              <div>
                <h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <BarChart3 className="w-6 h-6 text-[var(--green)]" />
                  API Usage Monitoring
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  Monitor your API key usage and request limits
                </p>
              </div>
            </div>
            <button
              onClick={loadMonitoringData}
              className="px-4 py-2 bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg transition-colors flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Today's Usage Card */}
        {todayUsage && (
          <div className="mb-8 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[var(--green)]" />
                Today&apos;s Usage
              </h2>
              {isNearLimit && (
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Near Limit</span>
                </div>
              )}
            </div>

            <div className="grid md:grid-cols-3 gap-6 mb-6">
              {/* Requests */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Requests</span>
                  <span
                    className={`text-sm font-semibold ${
                      todayUsage.is_allowed
                        ? "text-[var(--green)]"
                        : "text-red-500"
                    }`}
                  >
                    {todayUsage.request_count} / {todayUsage.limit}
                  </span>
                </div>
                <div className="w-full bg-[var(--surface)] rounded-full h-3 overflow-hidden">
                  <div
                    className={`h-full transition-all ${
                      todayUsage.is_allowed
                        ? isNearLimit
                          ? "bg-amber-500"
                          : "bg-[var(--green)]"
                        : "bg-red-500"
                    }`}
                    style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1">
                  {todayUsage.remaining} requests remaining today
                </p>
              </div>

              {/* Tokens */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Total Tokens</span>
                  <span className="text-sm font-semibold text-[var(--text-primary)]">
                    {todayUsage.total_tokens.toLocaleString()}
                  </span>
                </div>
                <div className="space-y-1 text-xs text-[var(--text-secondary)]">
                  <div className="flex justify-between">
                    <span>Input:</span>
                    <span>{todayUsage.input_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Output:</span>
                    <span>{todayUsage.output_tokens.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Embeddings:</span>
                    <span>{todayUsage.embedding_tokens.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              {/* Active Model */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Active Model</span>
                </div>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-[var(--text-primary)]">
                    {todayUsage.llm_provider || "N/A"}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)]">
                    {todayUsage.llm_model || "No model used"}
                  </div>
                </div>
              </div>
            </div>

            {!todayUsage.is_allowed && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-500">
                      Daily Limit Reached
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      You have reached your daily limit of {todayUsage.limit} requests.
                      Please try again tomorrow.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* API Keys Information */}
        {apiKeysInfo && (
          <div className="mb-8 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
              <Key className="w-5 h-5 text-[var(--green)]" />
              API Keys Status
            </h2>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              {/* Active Provider */}
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Active Provider</span>
                  <CheckCircle2 className="w-4 h-4 text-[var(--green)]" />
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {apiKeysInfo.active_provider || "None"}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">
                  {apiKeysInfo.active_model || "No model"}
                </div>
              </div>

              {/* Today's Usage Provider */}
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-[var(--text-secondary)]">Today&apos;s Usage</span>
                  <Database className="w-4 h-4 text-[var(--text-secondary)]" />
                </div>
                <div className="text-lg font-semibold text-[var(--text-primary)]">
                  {apiKeysInfo.today_usage.provider || "N/A"}
                </div>
                <div className="text-sm text-[var(--text-secondary)] mt-1">
                  {apiKeysInfo.today_usage.model || "No usage today"}
                </div>
              </div>
            </div>

            {/* Keys Configuration */}
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
                Configured Keys
              </h3>
              {Object.entries(apiKeysInfo.keys_configured).map(([key, info]) => (
                <div
                  key={key}
                  className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)] flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-[var(--text-primary)] capitalize">
                        {key}
                      </span>
                      {info.set ? (
                        <CheckCircle2 className="w-4 h-4 text-[var(--green)]" />
                      ) : (
                        <XCircle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mb-1">
                      {info.purpose}
                    </p>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {info.used_for}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Usage History */}
        {usageStats && (
          <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-[var(--green)]" />
                Usage History
              </h2>
              <div className="flex items-center gap-2">
                <select
                  value={selectedDays}
                  onChange={(e) => setSelectedDays(Number(e.target.value))}
                  className="px-3 py-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)]"
                >
                  <option value={7}>Last 7 days</option>
                  <option value={14}>Last 14 days</option>
                  <option value={30}>Last 30 days</option>
                </select>
              </div>
            </div>

            {/* Summary Stats */}
            <div className="grid md:grid-cols-3 gap-4 mb-6">
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Total Requests</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.total_requests}
                </div>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Total Tokens</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.total_tokens.toLocaleString()}
                </div>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Days Analyzed</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.days_analyzed}
                </div>
              </div>
            </div>

            {/* Daily Breakdown */}
            {usageStats.recent_days.length > 0 ? (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-[var(--text-primary)]">
                  Daily Breakdown
                </h3>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[var(--border)]">
                        <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Date
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Requests
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Input Tokens
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Output Tokens
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Embedding Tokens
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Total Tokens
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Provider
                        </th>
                        <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Model
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageStats.recent_days.map((day) => {
                        const date = new Date(day.usage_date);
                        const isToday =
                          date.toDateString() === new Date().toDateString();
                        return (
                          <tr
                            key={day.id}
                            className={`border-b border-[var(--border)] ${
                              isToday ? "bg-[var(--green)]/5" : ""
                            }`}
                          >
                            <td className="py-2 px-3 text-sm text-[var(--text-primary)]">
                              {isToday ? (
                                <span className="flex items-center gap-1">
                                  {date.toLocaleDateString()}
                                  <span className="text-[var(--green)] text-xs">(Today)</span>
                                </span>
                              ) : (
                                date.toLocaleDateString()
                              )}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-primary)]">
                              {day.request_count}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                              {day.input_tokens.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                              {day.output_tokens.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                              {day.embedding_tokens.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-sm text-right font-semibold text-[var(--text-primary)]">
                              {day.total_tokens.toLocaleString()}
                            </td>
                            <td className="py-2 px-3 text-sm text-[var(--text-secondary)] capitalize">
                              {day.llm_provider || "N/A"}
                            </td>
                            <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                              {day.llm_model || "N/A"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-secondary)]">
                <Zap className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No usage data available</p>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

