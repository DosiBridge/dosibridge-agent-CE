import React, { useEffect, useState } from 'react';
import { Loader2, Activity, Zap, Database, Cpu, Brain, Power, Edit2, Trash2, X, Eye, EyeOff } from 'lucide-react';
import { getTodayUsage, getApiKeysInfo, UsageStats, ApiKeysInfo } from '@/lib/api/monitoring';
import { listLLMConfigs, switchLLMConfig, deleteLLMConfig, updateLLMConfig, type LLMConfigListItem } from '@/lib/api/llm';
import type { LLMConfig } from '@/types/api';
import toast from 'react-hot-toast';

export default function UserStatsView() {
    const [loading, setLoading] = useState(true);
    const [usage, setUsage] = useState<UsageStats | null>(null);
    const [keysInfo, setKeysInfo] = useState<ApiKeysInfo | null>(null);
    const [llmConfigs, setLlmConfigs] = useState<LLMConfigListItem[]>([]);
    const [editingLLMConfig, setEditingLLMConfig] = useState<LLMConfigListItem | null>(null);
    const [llmEditForm, setLlmEditForm] = useState<{
        type: string;
        model: string;
        api_key: string;
        api_base: string;
    }>({
        type: "openai",
        model: "gpt-4o",
        api_key: "",
        api_base: "",
    });
    const [showApiKey, setShowApiKey] = useState(false);
    const [actionLoading, setActionLoading] = useState<number | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [usageData, keysData, configsData] = await Promise.all([
                    getTodayUsage(),
                    getApiKeysInfo(),
                    listLLMConfigs().catch(() => ({ configs: [] }))
                ]);
                setUsage(usageData);
                setKeysInfo(keysData);
                setLlmConfigs(configsData.configs);
            } catch (error) {
                console.error("Failed to load stats:", error);
                toast.error("Failed to load usage statistics");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    const handleSwitchConfig = async (configId: number) => {
        setActionLoading(configId);
        try {
            await switchLLMConfig(configId);
            toast.success("LLM configuration switched successfully");
            // Reload configs to reflect changes
            const configsData = await listLLMConfigs();
            setLlmConfigs(configsData.configs);
            // Also reload usage to show new provider/model
            const usageData = await getTodayUsage();
            setUsage(usageData);
        } catch (error: any) {
            console.error("Failed to switch LLM config:", error);
            toast.error(error?.message || "Failed to switch LLM configuration");
        } finally {
            setActionLoading(null);
        }
    };

    const handleEditConfig = (config: LLMConfigListItem) => {
        setEditingLLMConfig(config);
        setLlmEditForm({
            type: config.type,
            model: config.model,
            api_key: "",
            api_base: config.api_base || "",
        });
        setShowApiKey(false);
    };

    const handleSaveEdit = async () => {
        if (!editingLLMConfig) return;
        setActionLoading(editingLLMConfig.id);
        try {
            const configToUpdate: LLMConfig = {
                type: llmEditForm.type as LLMConfig['type'],
                model: llmEditForm.model,
            };
            if (llmEditForm.api_key) {
                configToUpdate.api_key = llmEditForm.api_key;
            }
            if (llmEditForm.api_base) {
                configToUpdate.api_base = llmEditForm.api_base;
            }
            await updateLLMConfig(editingLLMConfig.id, configToUpdate);
            toast.success("LLM configuration updated successfully");
            setEditingLLMConfig(null);
            // Reload configs
            const configsData = await listLLMConfigs();
            setLlmConfigs(configsData.configs);
        } catch (error: any) {
            console.error("Failed to update LLM config:", error);
            toast.error(error?.message || "Failed to update LLM configuration");
        } finally {
            setActionLoading(null);
        }
    };

    const handleDeleteConfig = async (configId: number) => {
        if (!confirm("Are you sure you want to delete this LLM configuration?")) {
            return;
        }
        setActionLoading(configId);
        try {
            await deleteLLMConfig(configId);
            toast.success("LLM configuration deleted successfully");
            // Reload configs
            const configsData = await listLLMConfigs();
            setLlmConfigs(configsData.configs);
        } catch (error: any) {
            console.error("Failed to delete LLM config:", error);
            toast.error(error?.message || "Failed to delete LLM configuration");
        } finally {
            setActionLoading(null);
        }
    };

    const cancelEditConfig = () => {
        setEditingLLMConfig(null);
        setLlmEditForm({
            type: "openai",
            model: "gpt-4o",
            api_key: "",
            api_base: "",
        });
        setShowApiKey(false);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12">
                <Loader2 className="w-8 h-8 animate-spin text-zinc-500" />
            </div>
        );
    }

    if (!usage || !keysInfo) return null;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-400">
                            <Activity className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">Daily Usage</h3>
                            <p className="text-xs text-zinc-500">Reset at midnight UTC</p>
                        </div>
                    </div>

                    <div className="space-y-4">
                        <div>
                            <div className="flex justify-between text-sm mb-1">
                                <span className="text-zinc-400">Requests</span>
                                <span className="text-white font-medium">
                                    {usage.request_count} / {usage.limit === -1 ? '∞' : usage.limit}
                                </span>
                            </div>
                            <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 rounded-full"
                                    style={{ width: `${usage.limit === -1 ? 0 : Math.min((usage.request_count / usage.limit) * 100, 100)}%` }}
                                />
                            </div>
                        </div>

                        <div className="pt-2 border-t border-zinc-800">
                            <div className="flex justify-between items-center text-sm">
                                <span className="text-zinc-400">Provider</span>
                                <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded text-xs">
                                    {usage.llm_provider || keysInfo.active_provider}
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-sm mt-2">
                                <span className="text-zinc-400">Model</span>
                                <span className="text-white font-mono bg-zinc-800 px-2 py-0.5 rounded text-xs truncate max-w-[150px]">
                                    {usage.llm_model || keysInfo.active_model}
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-5">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-500/10 rounded-lg text-emerald-400">
                            <Zap className="w-5 h-5" />
                        </div>
                        <div>
                            <h3 className="text-white font-medium">Token Consumption</h3>
                            <p className="text-xs text-zinc-500">Today's metrics</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                            <p className="text-xs text-zinc-500 mb-1">Input Tokens</p>
                            <p className="text-lg font-semibold text-white">{usage.input_tokens.toLocaleString()}</p>
                        </div>
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                            <p className="text-xs text-zinc-500 mb-1">Output Tokens</p>
                            <p className="text-lg font-semibold text-white">{usage.output_tokens.toLocaleString()}</p>
                        </div>
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                            <p className="text-xs text-zinc-500 mb-1">Total</p>
                            <p className="text-lg font-semibold text-white">{usage.total_tokens.toLocaleString()}</p>
                        </div>
                        <div className="bg-zinc-950/50 p-3 rounded-lg border border-zinc-800">
                            <p className="text-xs text-zinc-500 mb-1">Embedding</p>
                            <p className="text-lg font-semibold text-white">{usage.embedding_tokens.toLocaleString()}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <h3 className="text-white font-medium mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-amber-400" />
                    API Key Status
                </h3>

                <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium">OpenAI</span>
                                {keysInfo.keys_configured.openai.set ? (
                                    <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">Configured</span>
                                ) : (
                                    <span className="text-[10px] bg-red-500/10 text-red-400 px-1.5 py-0.5 rounded">Missing</span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{keysInfo.keys_configured.openai.purpose}</p>
                        </div>
                        <div className="text-right">
                            <Database className="w-4 h-4 text-zinc-600 ml-auto" />
                        </div>
                    </div>

                    <div className="flex items-center justify-between p-3 bg-zinc-950/50 rounded-lg border border-zinc-800">
                        <div>
                            <div className="flex items-center gap-2">
                                <span className="text-white font-medium">LLM Provider</span>
                                {keysInfo.keys_configured.llm.set ? (
                                    <span className="text-[10px] bg-green-500/10 text-green-400 px-1.5 py-0.5 rounded">Configured</span>
                                ) : (
                                    <span className="text-[10px] bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">Not Configured</span>
                                )}
                            </div>
                            <p className="text-xs text-zinc-500 mt-0.5">{keysInfo.keys_configured.llm.purpose}</p>
                        </div>
                        <div className="text-right">
                            <Cpu className="w-4 h-4 text-zinc-600 ml-auto" />
                        </div>
                    </div>
                </div>
            </div>

            {/* LLM Configurations Section */}
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 bg-purple-500/10 rounded-lg text-purple-400">
                        <Brain className="w-5 h-5" />
                    </div>
                    <div>
                        <h3 className="text-white font-medium">LLM Configurations</h3>
                        <p className="text-xs text-zinc-500">Manage your LLM configurations - switch, update, or delete saved configurations</p>
                    </div>
                </div>

                {llmConfigs.length > 0 ? (
                    <div className="space-y-3">
                        {llmConfigs.map((config) => (
                            <div
                                key={config.id}
                                className={`p-4 rounded-lg border ${
                                    config.active
                                        ? "bg-green-500/10 border-green-500/50"
                                        : "bg-zinc-950/50 border-zinc-800"
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 mb-2">
                                            <span className="text-sm font-semibold text-white capitalize">
                                                {config.type}
                                            </span>
                                            {config.active && (
                                                <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full flex items-center gap-1">
                                                    <Power className="w-3 h-3" />
                                                    Active
                                                </span>
                                            )}
                                            {config.is_default && (
                                                <span className="px-2 py-0.5 bg-amber-500/20 text-amber-400 text-xs rounded-full">
                                                    Default
                                                </span>
                                            )}
                                        </div>
                                        <div className="text-sm text-zinc-300 mb-1">
                                            Model: <span className="font-medium text-white">{config.model}</span>
                                        </div>
                                        <div className="flex items-center gap-4 text-xs text-zinc-500 mt-2">
                                            <span>
                                                API Key:{" "}
                                                {config.has_api_key ? (
                                                    <span className="text-green-400">✓ Set</span>
                                                ) : (
                                                    <span className="text-red-400">✗ Not set</span>
                                                )}
                                            </span>
                                            {config.api_base && (
                                                <span>API Base: <span className="text-zinc-400">{config.api_base}</span></span>
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2 ml-4">
                                        {!config.is_default && (
                                            <button
                                                onClick={() => handleEditConfig(config)}
                                                disabled={actionLoading === config.id}
                                                className="p-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                                                title="Edit this LLM configuration"
                                            >
                                                <Edit2 className="w-4 h-4 text-indigo-400" />
                                            </button>
                                        )}
                                        {!config.active && (
                                            <button
                                                onClick={() => handleSwitchConfig(config.id)}
                                                disabled={actionLoading === config.id}
                                                className="p-2 bg-zinc-800/50 hover:bg-zinc-800 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                                                title="Switch to this LLM"
                                            >
                                                {actionLoading === config.id ? (
                                                    <Loader2 className="w-4 h-4 text-green-400 animate-spin" />
                                                ) : (
                                                    <Power className="w-4 h-4 text-green-400" />
                                                )}
                                            </button>
                                        )}
                                        {!config.active && !config.is_default && (
                                            <button
                                                onClick={() => handleDeleteConfig(config.id)}
                                                disabled={actionLoading === config.id}
                                                className="p-2 bg-zinc-800/50 hover:bg-red-500/10 border border-zinc-700 rounded-lg transition-colors disabled:opacity-50"
                                                title="Delete this LLM configuration"
                                            >
                                                {actionLoading === config.id ? (
                                                    <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                )}
                                            </button>
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8 text-zinc-500">
                        <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No LLM configurations found. Add one in Settings.</p>
                    </div>
                )}
            </div>

            {/* Edit LLM Config Modal */}
            {editingLLMConfig && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
                    <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-lg p-6 space-y-4">
                        <div className="flex items-center justify-between mb-4">
                            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                <Edit2 className="w-5 h-5 text-indigo-400" />
                                Edit LLM Configuration
                            </h2>
                            <button
                                onClick={cancelEditConfig}
                                className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5 text-zinc-400" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    Provider Type
                                </label>
                                <select
                                    value={llmEditForm.type}
                                    onChange={(e) =>
                                        setLlmEditForm({ ...llmEditForm, type: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    disabled={editingLLMConfig.is_default}
                                >
                                    <option value="openai">OpenAI</option>
                                    <option value="deepseek">DeepSeek</option>
                                    <option value="anthropic">Anthropic</option>
                                    <option value="google">Google</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    Model
                                </label>
                                <input
                                    type="text"
                                    value={llmEditForm.model}
                                    onChange={(e) =>
                                        setLlmEditForm({ ...llmEditForm, model: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    placeholder="gpt-4o"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    API Key {editingLLMConfig.has_api_key && "(leave empty to keep current)"}
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKey ? "text" : "password"}
                                        value={llmEditForm.api_key}
                                        onChange={(e) =>
                                            setLlmEditForm({ ...llmEditForm, api_key: e.target.value })
                                        }
                                        className="w-full px-3 py-2 pr-10 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                        placeholder="sk-..."
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowApiKey(!showApiKey)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
                                    >
                                        {showApiKey ? (
                                            <EyeOff className="w-4 h-4" />
                                        ) : (
                                            <Eye className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-zinc-300 mb-1">
                                    API Base URL (optional)
                                </label>
                                <input
                                    type="text"
                                    value={llmEditForm.api_base}
                                    onChange={(e) =>
                                        setLlmEditForm({ ...llmEditForm, api_base: e.target.value })
                                    }
                                    className="w-full px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-indigo-500/50"
                                    placeholder="https://api.openai.com/v1"
                                />
                            </div>
                        </div>

                        <div className="flex items-center gap-3 pt-4 border-t border-zinc-800">
                            <button
                                onClick={handleSaveEdit}
                                disabled={actionLoading === editingLLMConfig.id}
                                className="flex-1 px-4 py-2 bg-indigo-500 hover:bg-indigo-600 text-white rounded-lg font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                            >
                                {actionLoading === editingLLMConfig.id ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    "Save Changes"
                                )}
                            </button>
                            <button
                                onClick={cancelEditConfig}
                                className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-white rounded-lg font-medium transition-colors"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
