/**
 * Monitoring Page - API Usage and Key Monitoring
 */
"use client";

import { useStore } from "@/lib/store";
import {
  getUsageStats,
  getTodayUsage,
  getAPIKeysInfo,
  getPerRequestStats,
  getIndividualRequests,
  type UsageStats,
  type TodayUsage,
  type APIKeysInfo,
  type PerRequestStats,
  type IndividualRequest,
} from "@/lib/api/monitoring";
import {
  listLLMConfigs,
  deleteLLMConfig,
  switchLLMConfig,
  type LLMConfigListItem,
} from "@/lib/api/llm";
import {
  Activity,
  AlertCircle,
  ArrowLeft,
  ArrowUp,
  BarChart3,
  Calendar,
  CheckCircle2,
  Database,
  Key,
  TrendingUp,
  XCircle,
  Zap,
  Brain,
  Power,
  Trash2,
  Edit2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  ComposedChart,
  Line,
  LineChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export default function MonitoringPage() {
  const router = useRouter();
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const [loading, setLoading] = useState(true);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);
  const [todayUsage, setTodayUsage] = useState<TodayUsage | null>(null);
  const [apiKeysInfo, setApiKeysInfo] = useState<APIKeysInfo | null>(null);
  const [perRequestStats, setPerRequestStats] = useState<PerRequestStats[]>([]);
  const [individualRequests, setIndividualRequests] = useState<IndividualRequest[]>([]);
  const [requestsTotal, setRequestsTotal] = useState(0);
  const [requestsLoading, setRequestsLoading] = useState(false);
  const [requestsOffset, setRequestsOffset] = useState(0);
  const [llmConfigs, setLlmConfigs] = useState<LLMConfigListItem[]>([]);
  const [selectedDays, setSelectedDays] = useState(7);
  const [groupBy, setGroupBy] = useState<"hour" | "day" | "minute">("hour");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      // Redirect to login if not authenticated
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      loadMonitoringData();
    }
  }, [isAuthenticated, authLoading, router, selectedDays, groupBy]);

  const loadMonitoringData = async () => {
    try {
      setLoading(true);
      const [stats, today, keys, perRequest, individual, configs] = await Promise.all([
        getUsageStats(selectedDays),
        getTodayUsage(),
        getAPIKeysInfo(),
        getPerRequestStats(selectedDays, groupBy),
        getIndividualRequests(selectedDays, 100, 0),
        listLLMConfigs().catch(() => ({ configs: [] })),
      ]);
      setUsageStats(stats);
      setTodayUsage(today);
      setApiKeysInfo(keys);
      setPerRequestStats(perRequest.requests);
      setIndividualRequests(individual.requests);
      setRequestsTotal(individual.total);
      setRequestsOffset(0);
      setLlmConfigs(configs.configs);
    } catch (error) {
      console.error("Failed to load monitoring data:", error);
      toast.error("Failed to load monitoring data");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!confirm("Are you sure you want to delete this LLM configuration?")) {
      return;
    }
    try {
      await deleteLLMConfig(configId);
      toast.success("LLM configuration deleted successfully");
      loadMonitoringData();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete LLM configuration");
    }
  };

  const handleSwitchConfig = async (configId: number) => {
    try {
      await switchLLMConfig(configId);
      toast.success("Switched LLM configuration successfully");
      loadMonitoringData();
      // Reload LLM config in store
      loadLLMConfig();
    } catch (error: any) {
      toast.error(error.message || "Failed to switch LLM configuration");
    }
  };

  const loadMoreRequests = async () => {
    try {
      setRequestsLoading(true);
      const data = await getIndividualRequests(selectedDays, 100, requestsOffset + 100);
      setIndividualRequests((prev) => [...prev, ...data.requests]);
      setRequestsOffset((prev) => prev + 100);
    } catch (error) {
      console.error("Failed to load more requests:", error);
      toast.error("Failed to load more requests");
    } finally {
      setRequestsLoading(false);
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

  const usagePercentage = todayUsage && todayUsage.limit > 0
    ? Math.round((todayUsage.request_count / todayUsage.limit) * 100)
    : 0;
  const isNearLimit = todayUsage && todayUsage.is_default_llm
    ? todayUsage.request_count >= todayUsage.limit * 0.8
    : false;

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
              {todayUsage.is_default_llm && isNearLimit && (
                <div className="flex items-center gap-2 text-amber-500">
                  <AlertCircle className="w-5 h-5" />
                  <span className="text-sm font-medium">Near Limit</span>
                </div>
              )}
              {!todayUsage.is_default_llm && (
                <div className="flex items-center gap-2 text-green-500">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">Unlimited</span>
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
                      todayUsage.is_default_llm
                        ? todayUsage.is_allowed
                          ? "text-[var(--green)]"
                          : "text-red-500"
                        : "text-[var(--green)]"
                    }`}
                  >
                    {todayUsage.request_count} {todayUsage.is_default_llm ? `/${todayUsage.limit}` : ""}
                  </span>
                </div>
                {todayUsage.is_default_llm ? (
                  <>
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
                  </>
                ) : (
                  <>
                    <div className="w-full bg-[var(--surface)] rounded-full h-3 overflow-hidden">
                      <div
                        className="h-full bg-[var(--green)]"
                        style={{ width: "100%" }}
                      />
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-1">
                      Unlimited requests (using custom API key)
                    </p>
                  </>
                )}
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

            {todayUsage.is_default_llm && !todayUsage.is_allowed && (
              <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <XCircle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-red-500">
                      Daily Limit Reached
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      You have reached your daily limit of {todayUsage.limit} requests.
                      Please try again tomorrow or add your own API key for unlimited requests.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {!todayUsage.is_default_llm && (
              <div className="mt-4 p-4 bg-green-500/10 border border-green-500/20 rounded-lg">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-green-500">
                      Using Custom API Key
                    </p>
                    <p className="text-sm text-[var(--text-secondary)] mt-1">
                      You're using your own API key. No daily request limits apply.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* LLM Configurations Management */}
        <div className="mb-8 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6">
          <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
            <Brain className="w-5 h-5 text-[var(--green)]" />
            LLM Configurations
          </h2>
          <p className="text-sm text-[var(--text-secondary)] mb-4">
            Manage your LLM configurations - switch, update, or delete saved configurations
          </p>
          {llmConfigs.length > 0 ? (
            <div className="space-y-3">
              {llmConfigs.map((config) => (
                <div
                  key={config.id}
                  className={`p-4 rounded-lg border ${
                    config.active
                      ? "bg-[var(--green)]/10 border-[var(--green)]"
                      : "bg-[var(--surface)] border-[var(--border)]"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-[var(--text-primary)] capitalize">
                          {config.type}
                        </span>
                        {config.active && (
                          <span className="px-2 py-0.5 bg-[var(--green)] text-white text-xs rounded-full flex items-center gap-1">
                            <Power className="w-3 h-3" />
                            Active
                          </span>
                        )}
                        {config.is_default && (
                          <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-xs rounded-full">
                            Default
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-[var(--text-primary)] mb-1">
                        Model: <span className="font-medium">{config.model}</span>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-[var(--text-secondary)]">
                        <span>
                          API Key:{" "}
                          {config.has_api_key ? (
                            <span className="text-[var(--green)]">✓ Set</span>
                          ) : (
                            <span className="text-red-500">✗ Not set</span>
                          )}
                        </span>
                        {config.base_url && (
                          <span>Base URL: {config.base_url}</span>
                        )}
                        {config.api_base && (
                          <span>API Base: {config.api_base}</span>
                        )}
                        {config.created_at && (
                          <span>
                            Created:{" "}
                            {new Date(config.created_at).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      {!config.active && (
                        <button
                          onClick={() => handleSwitchConfig(config.id)}
                          className="p-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg transition-colors"
                          title="Switch to this LLM"
                        >
                          <Power className="w-4 h-4 text-[var(--green)]" />
                        </button>
                      )}
                      {!config.active && (
                        <button
                          onClick={() => handleDeleteConfig(config.id)}
                          className="p-2 bg-[var(--surface)] hover:bg-red-500/10 border border-[var(--border)] rounded-lg transition-colors"
                          title="Delete this LLM configuration"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-[var(--text-secondary)]">
              <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>No LLM configurations found. Add one in Settings.</p>
            </div>
          )}
        </div>

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
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Total Requests</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.total_requests}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {usageStats.days_analyzed > 0
                    ? `${Math.round(usageStats.total_requests / usageStats.days_analyzed)} per day`
                    : "0 per day"}
                </div>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Total Tokens</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.total_tokens.toLocaleString()}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {usageStats.total_requests > 0
                    ? `${Math.round(usageStats.total_tokens / usageStats.total_requests).toLocaleString()} per request`
                    : "0 per request"}
                </div>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Valid Requests</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.recent_days
                    .filter((day) => day.total_tokens > 0)
                    .reduce((sum, day) => sum + day.request_count, 0)}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  {usageStats.total_requests > 0
                    ? `${Math.round(
                        (usageStats.recent_days
                          .filter((day) => day.total_tokens > 0)
                          .reduce((sum, day) => sum + day.request_count, 0) /
                          usageStats.total_requests) *
                          100
                      )}% success rate`
                    : "0% success rate"}
                </div>
              </div>
              <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                <div className="text-sm text-[var(--text-secondary)] mb-1">Days Analyzed</div>
                <div className="text-2xl font-bold text-[var(--text-primary)]">
                  {usageStats.days_analyzed}
                </div>
                <div className="text-xs text-[var(--text-secondary)] mt-1">
                  Last {selectedDays} days
                </div>
              </div>
            </div>

            {/* Per Request Metrics */}
            <div className="mb-6 bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6">
              <h3 className="text-lg font-semibold text-[var(--text-primary)] mb-4 flex items-center gap-2">
                <Activity className="w-5 h-5 text-[var(--green)]" />
                Per Request Metrics
              </h3>
              <div className="grid md:grid-cols-3 gap-4">
                <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Average Tokens per Request</div>
                  <div className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                    {usageStats.total_requests > 0
                      ? Math.round(usageStats.total_tokens / usageStats.total_requests).toLocaleString()
                      : 0}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] space-y-1">
                    <div className="flex justify-between">
                      <span>Input:</span>
                      <span>
                        {usageStats.total_requests > 0
                          ? Math.round(
                              usageStats.recent_days.reduce(
                                (sum, day) => sum + day.input_tokens,
                                0
                              ) / usageStats.total_requests
                            ).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Output:</span>
                      <span>
                        {usageStats.total_requests > 0
                          ? Math.round(
                              usageStats.recent_days.reduce(
                                (sum, day) => sum + day.output_tokens,
                                0
                              ) / usageStats.total_requests
                            ).toLocaleString()
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Embedding:</span>
                      <span>
                        {usageStats.total_requests > 0
                          ? Math.round(
                              usageStats.recent_days.reduce(
                                (sum, day) => sum + day.embedding_tokens,
                                0
                              ) / usageStats.total_requests
                            ).toLocaleString()
                          : 0}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Requests per Day</div>
                  <div className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                    {usageStats.days_analyzed > 0
                      ? Math.round(usageStats.total_requests / usageStats.days_analyzed)
                      : 0}
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] space-y-1">
                    <div className="flex justify-between">
                      <span>Max:</span>
                      <span>
                        {usageStats.recent_days.length > 0
                          ? Math.max(...usageStats.recent_days.map((day) => day.request_count))
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Min:</span>
                      <span>
                        {usageStats.recent_days.length > 0
                          ? Math.min(...usageStats.recent_days.map((day) => day.request_count))
                          : 0}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span>{usageStats.total_requests}</span>
                    </div>
                  </div>
                </div>
                <div className="p-4 bg-[var(--surface)] rounded-lg border border-[var(--border)]">
                  <div className="text-sm text-[var(--text-secondary)] mb-2">Valid Data Rate</div>
                  <div className="text-3xl font-bold text-[var(--text-primary)] mb-2">
                    {usageStats.total_requests > 0
                      ? Math.round(
                          (usageStats.recent_days
                            .filter((day) => day.total_tokens > 0)
                            .reduce((sum, day) => sum + day.request_count, 0) /
                            usageStats.total_requests) *
                            100
                        )
                      : 0}
                    <span className="text-lg">%</span>
                  </div>
                  <div className="text-xs text-[var(--text-secondary)] space-y-1">
                    <div className="flex justify-between">
                      <span>Valid:</span>
                      <span className="text-[var(--green)]">
                        {usageStats.recent_days
                          .filter((day) => day.total_tokens > 0)
                          .reduce((sum, day) => sum + day.request_count, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Invalid:</span>
                      <span className="text-red-500">
                        {usageStats.recent_days
                          .filter((day) => day.total_tokens === 0 && day.request_count > 0)
                          .reduce((sum, day) => sum + day.request_count, 0)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total:</span>
                      <span>{usageStats.total_requests}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            {usageStats.recent_days.length > 0 && (
              <div className="grid lg:grid-cols-2 gap-6 mb-6">
                {/* Requests Over Time Chart - Interactive Line Chart */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-4">
                  <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-4">
                    Requests Over Time
                  </h3>
                  <ChartContainer
                    config={{
                      requests: {
                        label: "Requests",
                        color: "#10b981",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <LineChart
                      data={usageStats.recent_days.map((day) => ({
                        date: new Date(day.usage_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }),
                        requests: day.request_count,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={{ fill: "#10b981", r: 4 }}
                        activeDot={{ r: 6 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                {/* Tokens Over Time Chart - Multiple Line Chart */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Tokens Over Time
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Token usage breakdown by type
                    </p>
                  </div>
                  <ChartContainer
                    config={{
                      input: {
                        label: "Input Tokens",
                        color: "#3b82f6",
                      },
                      output: {
                        label: "Output Tokens",
                        color: "#10b981",
                      },
                      embedding: {
                        label: "Embedding Tokens",
                        color: "#f59e0b",
                      },
                      total: {
                        label: "Total Tokens",
                        color: "#8b5cf6",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <LineChart
                      data={usageStats.recent_days.map((day) => ({
                        date: new Date(day.usage_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }),
                        input: day.input_tokens,
                        output: day.output_tokens,
                        embedding: day.embedding_tokens,
                        total: day.total_tokens,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="natural"
                        dataKey="input"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#3b82f6", strokeWidth: 2 }}
                      />
                      <Line
                        type="natural"
                        dataKey="output"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        type="natural"
                        dataKey="embedding"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#f59e0b", strokeWidth: 2 }}
                      />
                      <Line
                        type="natural"
                        dataKey="total"
                        stroke="#8b5cf6"
                        strokeWidth={2.5}
                        dot={false}
                        activeDot={{ r: 5, stroke: "#8b5cf6", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>

                {/* Daily Requests Line Chart - Default */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Line Chart
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      {usageStats.recent_days.length > 0 && (() => {
                        const firstDate = new Date(usageStats.recent_days[0].usage_date);
                        const lastDate = new Date(usageStats.recent_days[usageStats.recent_days.length - 1].usage_date);
                        return `${firstDate.toLocaleDateString("en-US", { month: "long", day: "numeric" })} - ${lastDate.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;
                      })()}
                    </p>
                  </div>
                  <ChartContainer
                    config={{
                      requests: {
                        label: "Requests",
                        color: "#3b82f6",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <LineChart
                      data={usageStats.recent_days.map((day) => ({
                        date: new Date(day.usage_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }),
                        requests: day.request_count,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <Line
                        type="monotone"
                        dataKey="requests"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#3b82f6", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ChartContainer>
                  {usageStats.recent_days.length > 1 && (() => {
                    const recent = usageStats.recent_days.slice(-2);
                    const change = recent[1].request_count - recent[0].request_count;
                    const percentChange = recent[0].request_count > 0 
                      ? ((change / recent[0].request_count) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <ArrowUp className={`w-3 h-3 ${change >= 0 ? 'text-[var(--green)]' : 'text-red-500 rotate-180'}`} />
                        <span className={change >= 0 ? 'text-[var(--green)]' : 'text-red-500'}>
                          Trending {change >= 0 ? 'up' : 'down'} by {Math.abs(parseFloat(percentChange))}% {change >= 0 ? 'this' : 'from last'} period
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Combined Requests & Tokens Chart - Multiple Line Chart */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Requests vs Total Tokens
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Comparing request volume and token consumption
                    </p>
                  </div>
                  <ChartContainer
                    config={{
                      requests: {
                        label: "Requests",
                        color: "#10b981",
                      },
                      tokens: {
                        label: "Tokens (K)",
                        color: "#3b82f6",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <ComposedChart
                      data={usageStats.recent_days.map((day) => ({
                        date: new Date(day.usage_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }),
                        requests: day.request_count,
                        tokens: Math.round(day.total_tokens / 1000), // Convert to thousands for better scale
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        yAxisId="left"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        yAxisId="left"
                        type="natural"
                        dataKey="requests"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="right"
                        type="natural"
                        dataKey="tokens"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#3b82f6", strokeWidth: 2 }}
                      />
                    </ComposedChart>
                  </ChartContainer>
                </div>

                {/* Tokens Per Request Chart - Linear Line Chart */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Line Chart - Linear
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Average tokens per request over time
                    </p>
                  </div>
                  <ChartContainer
                    config={{
                      avgTokensPerRequest: {
                        label: "Avg Total Tokens/Request",
                        color: "#3b82f6",
                      },
                      inputPerRequest: {
                        label: "Avg Input Tokens/Request",
                        color: "#10b981",
                      },
                      outputPerRequest: {
                        label: "Avg Output Tokens/Request",
                        color: "#f59e0b",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <LineChart
                      data={usageStats.recent_days.map((day) => ({
                        date: new Date(day.usage_date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                        }),
                        avgTokensPerRequest:
                          day.request_count > 0
                            ? Math.round(day.total_tokens / day.request_count)
                            : 0,
                        inputPerRequest:
                          day.request_count > 0
                            ? Math.round(day.input_tokens / day.request_count)
                            : 0,
                        outputPerRequest:
                          day.request_count > 0
                            ? Math.round(day.output_tokens / day.request_count)
                            : 0,
                      }))}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="linear"
                        dataKey="avgTokensPerRequest"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#3b82f6", strokeWidth: 2 }}
                      />
                      <Line
                        type="linear"
                        dataKey="inputPerRequest"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        type="linear"
                        dataKey="outputPerRequest"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#f59e0b", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ChartContainer>
                  {usageStats.recent_days.length > 1 && (() => {
                    const recent = usageStats.recent_days.slice(-2);
                    const current = recent[1].request_count > 0 
                      ? Math.round(recent[1].total_tokens / recent[1].request_count)
                      : 0;
                    const previous = recent[0].request_count > 0
                      ? Math.round(recent[0].total_tokens / recent[0].request_count)
                      : 0;
                    const change = current - previous;
                    const percentChange = previous > 0 
                      ? ((change / previous) * 100).toFixed(1)
                      : "0.0";
                    return (
                      <div className="mt-4 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                        <ArrowUp className={`w-3 h-3 ${change >= 0 ? 'text-[var(--green)]' : 'text-red-500 rotate-180'}`} />
                        <span className={change >= 0 ? 'text-[var(--green)]' : 'text-red-500'}>
                          Trending {change >= 0 ? 'up' : 'down'} by {Math.abs(parseFloat(percentChange))}% {change >= 0 ? 'this' : 'from last'} period
                        </span>
                      </div>
                    );
                  })()}
                </div>

                {/* Valid Requests Chart - Multiple Line Chart */}
                <div className="bg-[var(--surface)] rounded-lg border border-[var(--border)] p-6">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-[var(--text-primary)] mb-1">
                      Line Chart - Multiple
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)]">
                      Valid vs invalid request trends
                    </p>
                  </div>
                  <ChartContainer
                    config={{
                      valid: {
                        label: "Valid Requests",
                        color: "#10b981",
                      },
                      invalid: {
                        label: "Invalid Requests",
                        color: "#ef4444",
                      },
                      total: {
                        label: "Total Requests",
                        color: "#8b5cf6",
                      },
                    }}
                    className="h-[250px] w-full"
                  >
                    <LineChart
                      data={usageStats.recent_days.map((day) => {
                        // Valid requests are those that resulted in token usage
                        // If tokens > 0, we consider requests as valid (at least some)
                        // If tokens = 0 but requests > 0, those are likely invalid/failed
                        const validRequests = day.total_tokens > 0 ? day.request_count : 0;
                        const invalidRequests =
                          day.total_tokens === 0 && day.request_count > 0 ? day.request_count : 0;
                        return {
                          date: new Date(day.usage_date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          }),
                          valid: validRequests,
                          invalid: invalidRequests,
                          total: day.request_count,
                        };
                      })}
                      margin={{ top: 5, right: 10, left: 0, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                      <XAxis
                        dataKey="date"
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                      />
                      <YAxis
                        tickLine={false}
                        axisLine={false}
                        tickMargin={8}
                        className="text-xs fill-[var(--text-secondary)]"
                        width={40}
                      />
                      <ChartTooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={<ChartTooltipContent />}
                      />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        type="natural"
                        dataKey="valid"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        type="natural"
                        dataKey="invalid"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#ef4444", strokeWidth: 2 }}
                      />
                      <Line
                        type="natural"
                        dataKey="total"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 5, stroke: "#8b5cf6", strokeWidth: 2 }}
                      />
                    </LineChart>
                  </ChartContainer>
                </div>
              </div>
            )}

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
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Tokens/Request
                        </th>
                        <th className="text-right py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                          Valid Requests
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
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                              {day.request_count > 0
                                ? Math.round(day.total_tokens / day.request_count).toLocaleString()
                                : 0}
                            </td>
                            <td className="py-2 px-3 text-sm text-right text-[var(--text-primary)]">
                              <span
                                className={
                                  day.total_tokens > 0 ? "text-[var(--green)]" : "text-red-500"
                                }
                              >
                                {day.total_tokens > 0 ? day.request_count : 0}
                              </span>
                              {day.request_count > 0 && (
                                <span className="text-[var(--text-secondary)] ml-1">
                                  / {day.request_count}
                                </span>
                              )}
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

        {/* Individual Requests Table */}
        {individualRequests.length > 0 && (
          <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6 mt-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
              <Activity className="w-5 h-5 text-[var(--green)]" />
              Individual Requests
            </h2>
            <p className="text-sm text-[var(--text-secondary)] mb-4">
              Detailed view of each API request with LLM provider, model, and token usage
            </p>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[var(--border)]">
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                      Time
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                      LLM Provider
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                      Model
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
                      Mode
                    </th>
                    <th className="text-left py-2 px-3 text-sm font-semibold text-[var(--text-secondary)]">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {individualRequests.map((req) => {
                    const timestamp = new Date(req.request_timestamp);
                    return (
                      <tr
                        key={req.id}
                        className="border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
                      >
                        <td className="py-2 px-3 text-sm text-[var(--text-primary)]">
                          {timestamp.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-sm text-[var(--text-primary)] capitalize">
                          {req.llm_provider || "N/A"}
                        </td>
                        <td className="py-2 px-3 text-sm text-[var(--text-secondary)]">
                          {req.llm_model || "N/A"}
                        </td>
                        <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                          {req.input_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                          {req.output_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-sm text-right text-[var(--text-secondary)]">
                          {req.embedding_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-sm text-right font-semibold text-[var(--text-primary)]">
                          {req.total_tokens.toLocaleString()}
                        </td>
                        <td className="py-2 px-3 text-sm text-[var(--text-secondary)] capitalize">
                          {req.mode || "N/A"}
                        </td>
                        <td className="py-2 px-3 text-sm">
                          {req.success ? (
                            <span className="flex items-center gap-1 text-[var(--green)]">
                              <CheckCircle2 className="w-4 h-4" />
                              Success
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-red-500">
                              <XCircle className="w-4 h-4" />
                              Failed
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {requestsTotal > individualRequests.length && (
              <div className="mt-4 flex justify-center">
                <button
                  onClick={loadMoreRequests}
                  disabled={requestsLoading}
                  className="px-4 py-2 bg-[var(--surface)] hover:bg-[var(--surface-hover)] border border-[var(--border)] rounded-lg text-sm text-[var(--text-primary)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {requestsLoading ? "Loading..." : `Load More (${requestsTotal - individualRequests.length} remaining)`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Per Request Data by Time */}
        {perRequestStats.length > 0 && (
          <div className="bg-[var(--surface-elevated)] rounded-xl border border-[var(--border)] p-6 mt-8">
            <h2 className="text-xl font-semibold text-[var(--text-primary)] flex items-center gap-2 mb-4">
              <TrendingUp className="w-5 h-5 text-[var(--green)]" />
              Requests Per {groupBy.charAt(0).toUpperCase() + groupBy.slice(1)}
            </h2>
            <ChartContainer
              config={{
                requests: {
                  label: "Total Requests",
                  color: "#10b981",
                },
                valid: {
                  label: "Valid Requests",
                  color: "#10b981",
                },
                invalid: {
                  label: "Invalid Requests",
                  color: "#ef4444",
                },
                tokens: {
                  label: "Total Tokens (K)",
                  color: "#3b82f6",
                },
                avgTokensPerRequest: {
                  label: "Avg Tokens/Request",
                  color: "#f59e0b",
                },
              }}
              className="h-[400px] w-full"
            >
              <ComposedChart
                data={perRequestStats.map((stat) => ({
                  timestamp: stat.timestamp,
                  requests: stat.request_count,
                  tokens: Math.round(stat.total_tokens / 1000), // Convert to thousands
                  avgTokensPerRequest: stat.avg_tokens_per_request,
                  valid: stat.valid_requests,
                  invalid: stat.invalid_requests,
                }))}
                margin={{ top: 5, right: 20, left: 0, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-[var(--border)] opacity-30" />
                <XAxis
                  dataKey="timestamp"
                  tickLine={false}
                  axisLine={false}
                  className="text-xs fill-[var(--text-secondary)]"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                />
                <YAxis
                  yAxisId="left"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs fill-[var(--text-secondary)]"
                  label={{ value: "Requests", angle: -90, position: "insideLeft" }}
                />
                <YAxis
                  yAxisId="right"
                  orientation="right"
                  tickLine={false}
                  axisLine={false}
                  tickMargin={8}
                  className="text-xs fill-[var(--text-secondary)]"
                  label={{ value: "Tokens (K)", angle: 90, position: "insideRight" }}
                />
                <ChartTooltip
                  cursor={{ strokeDasharray: "3 3" }}
                  content={<ChartTooltipContent />}
                />
                <ChartLegend content={<ChartLegendContent />} />
                      <Line
                        yAxisId="left"
                        type="natural"
                        dataKey="requests"
                        stroke="#10b981"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="left"
                        type="natural"
                        dataKey="valid"
                        stroke="#10b981"
                        strokeWidth={2}
                        strokeDasharray="5 5"
                        dot={false}
                        activeDot={{ r: 4, stroke: "#10b981", strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="left"
                        type="natural"
                        dataKey="invalid"
                        stroke="#ef4444"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#ef4444", strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="right"
                        type="natural"
                        dataKey="tokens"
                        stroke="#3b82f6"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#3b82f6", strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="right"
                        type="natural"
                        dataKey="avgTokensPerRequest"
                        stroke="#f59e0b"
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4, stroke: "#f59e0b", strokeWidth: 2 }}
                      />
              </ComposedChart>
            </ChartContainer>
          </div>
        )}
      </main>
    </div>
  );
}

