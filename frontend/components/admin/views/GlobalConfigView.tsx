import React, { useState, useEffect } from 'react';
import {
    Globe,
    Server,
    Plus,
    Trash2,
    ShieldAlert,
    Save,
    Edit2,
    Power,
    RefreshCw,
    Lock
} from 'lucide-react';
import {
    createGlobalLLMConfig,
    createGlobalMCPServer,
    deleteGlobalMCPServer,
    listGlobalMCPServers,
    updateGlobalMCPServer,
    toggleGlobalMCPServer,
    listGlobalLLMConfigs,
    updateGlobalLLMConfig,
    deleteGlobalLLMConfig,
    toggleGlobalLLMConfig,
    createGlobalEmbeddingConfig,
    listGlobalEmbeddingConfigs,
    updateGlobalEmbeddingConfig,
    deleteGlobalEmbeddingConfig,
    toggleGlobalEmbeddingConfig
} from '@/lib/api/admin';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function GlobalConfigView() {
    const [activeTab, setActiveTab] = useState<'llm' | 'embedding' | 'mcp'>('llm');
    const [llmForm, setLlmForm] = useState({
        type: 'openai',
        model: 'gpt-4o',
        api_key: '',
        base_url: '',
        is_default: true
    });
    const [mcpForm, setMcpForm] = useState({
        name: '',
        url: '',
        connection_type: 'http',
        api_key: ''
    });
    const [editingLLMId, setEditingLLMId] = useState<number | null>(null);
    const [editingEmbeddingId, setEditingEmbeddingId] = useState<number | null>(null);
    const [editingMCPId, setEditingMCPId] = useState<number | null>(null);
    const [globalLLMConfigs, setGlobalLLMConfigs] = useState<any[]>([]);
    const [globalEmbeddingConfigs, setGlobalEmbeddingConfigs] = useState<any[]>([]);
    const [globalMCPServers, setGlobalMCPServers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [savingLLM, setSavingLLM] = useState(false);
    const [savingMCP, setSavingMCP] = useState(false);
    const [savingEmbedding, setSavingEmbedding] = useState(false);
    const [embeddingForm, setEmbeddingForm] = useState({
        provider: 'openai',
        model: 'text-embedding-3-small',
        api_key: '',
        base_url: '',
        is_default: true
    });

    useEffect(() => {
        loadGlobalConfigs();
    }, [activeTab]);

    const loadGlobalConfigs = async () => {
        setLoading(true);
        try {
            if (activeTab === 'llm') {
                const response = await listGlobalLLMConfigs();
                const configs = response.configs || [];
                setGlobalLLMConfigs(configs);
                if (configs.length === 0) {
                    console.log("No global LLM configs found. Auto-initialized configs should appear here.");
                }
            } else if (activeTab === 'embedding') {
                const response = await listGlobalEmbeddingConfigs();
                const configs = response.configs || [];
                setGlobalEmbeddingConfigs(configs);
                if (configs.length === 0) {
                    console.log("No global embedding configs found. Auto-initialized configs should appear here.");
                }
            } else {
                const response = await listGlobalMCPServers();
                const servers = response.servers || [];
                setGlobalMCPServers(servers);
            }
        } catch (error: any) {
            const tabName = activeTab === 'llm' ? 'LLM configs' : activeTab === 'embedding' ? 'embedding configs' : 'MCP servers';
            console.error(`Failed to load global ${tabName}:`, error);
            toast.error(`Failed to load global ${tabName}: ${error.message || error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLlmSubmit = async () => {
        setSavingLLM(true);
        try {
            if (editingLLMId) {
                await updateGlobalLLMConfig(editingLLMId, llmForm);
                toast.success("Global LLM Configuration updated successfully");
            } else {
                await createGlobalLLMConfig(llmForm);
                toast.success("Global LLM Configuration created successfully");
            }
            setLlmForm({ type: 'openai', model: 'gpt-4o', api_key: '', base_url: '', is_default: true });
            setEditingLLMId(null);
            await loadGlobalConfigs();
        } catch (error: any) {
            // Extract error message from backend response
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to save global LLM config";
            toast.error(errorMessage);
            console.error("Failed to save global LLM config:", error);
        } finally {
            setSavingLLM(false);
        }
    };

    const handleMcpSubmit = async () => {
        setSavingMCP(true);
        try {
            if (editingMCPId) {
                await updateGlobalMCPServer(editingMCPId, mcpForm);
                toast.success("Global MCP Server updated successfully");
            } else {
                await createGlobalMCPServer(mcpForm);
                toast.success("Global MCP Server added");
            }
            setMcpForm({ name: '', url: '', connection_type: 'http', api_key: '' });
            setEditingMCPId(null);
            await loadGlobalConfigs();
        } catch (error: any) {
            // Extract error message from backend response
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to save global MCP server";
            toast.error(errorMessage);
            console.error("Failed to save global MCP server:", error);
        } finally {
            setSavingMCP(false);
        }
    };

    const handleDeleteLLM = async (id: number) => {
        const config = globalLLMConfigs.find(c => c.id === id);
        const isDefault = config?.is_default;
        
        const message = isDefault 
            ? "Are you sure you want to delete this default LLM configuration? A new default will be automatically created if needed."
            : "Are you sure you want to delete this global LLM configuration?";
        
        if (!confirm(message)) return;
        
        try {
            await deleteGlobalLLMConfig(id);
            toast.success("Global LLM configuration deleted" + (isDefault ? ". A new default has been set." : ""));
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to delete global LLM config";
            toast.error(errorMessage);
            console.error("Failed to delete global LLM config:", error);
        }
    };

    const handleDeleteMCP = async (id: number) => {
        if (!confirm("Are you sure you want to delete this global MCP server?")) return;
        try {
            await deleteGlobalMCPServer(id);
            toast.success("Global MCP server deleted");
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to delete global MCP server";
            toast.error(errorMessage);
            console.error("Failed to delete global MCP server:", error);
        }
    };

    const handleToggleLLM = async (id: number) => {
        try {
            await toggleGlobalLLMConfig(id);
            toast.success("Global LLM configuration status updated");
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to toggle global LLM config";
            toast.error(errorMessage);
            console.error("Failed to toggle global LLM config:", error);
        }
    };

    const handleToggleMCP = async (id: number) => {
        try {
            await toggleGlobalMCPServer(id);
            toast.success("Global MCP server status updated");
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to toggle global MCP server";
            toast.error(errorMessage);
            console.error("Failed to toggle global MCP server:", error);
        }
    };

    const startEditLLM = (config: any) => {
        setEditingLLMId(config.id);
        setLlmForm({
            type: config.type,
            model: config.model,
            api_key: '', // Don't populate API key for security
            base_url: config.base_url || '',
            is_default: config.is_default || false
        });
    };

    const handleEmbeddingSubmit = async () => {
        setSavingEmbedding(true);
        try {
            if (editingEmbeddingId) {
                await updateGlobalEmbeddingConfig(editingEmbeddingId, embeddingForm);
                toast.success("Global Embedding Configuration updated successfully");
            } else {
                await createGlobalEmbeddingConfig(embeddingForm);
                toast.success("Global Embedding Configuration created successfully");
            }
            setEmbeddingForm({ provider: 'openai', model: 'text-embedding-3-small', api_key: '', base_url: '', is_default: true });
            setEditingEmbeddingId(null);
            await loadGlobalConfigs();
        } catch (error: any) {
            // Extract error message from backend response
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to save global embedding config";
            toast.error(errorMessage);
            console.error("Failed to save global embedding config:", error);
        } finally {
            setSavingEmbedding(false);
        }
    };

    const handleDeleteEmbedding = async (id: number) => {
        const config = globalEmbeddingConfigs.find(c => c.id === id);
        const isDefault = config?.is_default;
        
        const message = isDefault 
            ? "Are you sure you want to delete this default embedding configuration? A new default will be automatically created if needed."
            : "Are you sure you want to delete this global embedding configuration?";
        
        if (!confirm(message)) return;
        
        try {
            await deleteGlobalEmbeddingConfig(id);
            toast.success("Global embedding configuration deleted" + (isDefault ? ". A new default has been set." : ""));
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to delete global embedding config";
            toast.error(errorMessage);
            console.error("Failed to delete global embedding config:", error);
        }
    };

    const handleToggleEmbedding = async (id: number) => {
        try {
            await toggleGlobalEmbeddingConfig(id);
            toast.success("Global Embedding Configuration toggled");
            await loadGlobalConfigs();
        } catch (error: any) {
            const errorMessage = error?.detail || error?.message || error?.error || "Failed to toggle global embedding config";
            toast.error(errorMessage);
            console.error("Failed to toggle global embedding config:", error);
        }
    };

    const startEditEmbedding = (config: any) => {
        setEditingEmbeddingId(config.id);
        setEmbeddingForm({
            provider: config.provider,
            model: config.model,
            api_key: '', // Don't populate API key for security
            base_url: config.base_url || '',
            is_default: config.is_default || false
        });
    };

    const startEditMCP = (server: any) => {
        setEditingMCPId(server.id);
        setMcpForm({
            name: server.name,
            url: server.url,
            connection_type: server.connection_type || 'http',
            api_key: '' // Don't populate API key for security
        });
    };

    return (
        <div className="space-y-8">
            <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                    <Globe className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                    <h2 className="text-2xl font-bold text-white">Global Configuration</h2>
                    <p className="text-zinc-400 text-sm">Manage global settings available to all users. Users can use but cannot modify these.</p>
                </div>
            </div>

            <div className="flex gap-4 border-b border-white/5 pb-4">
                <button
                    onClick={() => setActiveTab('llm')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'llm' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                    Global LLM Configs
                </button>
                <button
                    onClick={() => setActiveTab('embedding')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'embedding' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                    Global Embeddings
                </button>
                <button
                    onClick={() => setActiveTab('mcp')}
                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'mcp' ? 'bg-white text-black' : 'text-zinc-400 hover:text-white hover:bg-white/5'}`}
                >
                    Global MCP Servers
                </button>
            </div>

            <div className="max-w-4xl">
                {activeTab === 'llm' && (
                    <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6"
                    >
                        <div className="flex items-start gap-4 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl mb-6">
                            <ShieldAlert className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-blue-200">
                                    <strong>Global LLM Configuration:</strong> These configurations are available to all users. Users can use them but cannot modify, delete, or disable them. Only superadmins can manage these.
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                {editingLLMId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                                {editingLLMId ? 'Edit' : 'Create'} Global LLM Configuration
                            </h3>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Provider</label>
                                <select
                                    value={llmForm.type}
                                    onChange={e => setLlmForm({ ...llmForm, type: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-white"
                                >
                                    <option value="openai">OpenAI</option>
                                    <option value="deepseek">DeepSeek</option>
                                    <option value="anthropic">Anthropic</option>
                                        <option value="groq">Groq</option>
                                        <option value="ollama">Ollama</option>
                                        <option value="gemini">Gemini</option>
                                        <option value="openrouter">OpenRouter</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Model Name</label>
                                <input
                                    type="text"
                                    value={llmForm.model}
                                    onChange={e => setLlmForm({ ...llmForm, model: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-white"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm font-medium text-zinc-300">API Key</label>
                                <input
                                    type="password"
                                    value={llmForm.api_key}
                                    onChange={e => setLlmForm({ ...llmForm, api_key: e.target.value })}
                                        placeholder="sk-... (leave empty to keep existing)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-white"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Base URL (Optional)</label>
                                <input
                                    type="text"
                                    value={llmForm.base_url}
                                    onChange={e => setLlmForm({ ...llmForm, base_url: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-blue-500/50 text-white"
                                />
                            </div>
                                <div className="col-span-2 flex items-center gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-xl">
                                    <input
                                        type="checkbox"
                                        id="is_default"
                                        checked={llmForm.is_default}
                                        onChange={e => setLlmForm({ ...llmForm, is_default: e.target.checked })}
                                        className="w-4 h-4 text-blue-600 bg-black/40 border-white/20 rounded focus:ring-blue-500"
                                    />
                                    <label htmlFor="is_default" className="text-sm font-medium text-zinc-300 cursor-pointer">
                                        Mark as Default Configuration
                                    </label>
                                    <span className="text-xs text-blue-400 ml-auto">
                                        Only one global config can be default. Setting this will unset others.
                                    </span>
                                </div>
                        </div>

                            <div className="pt-4 flex justify-end gap-2">
                                {editingLLMId && (
                                    <button
                                        onClick={() => {
                                            setEditingLLMId(null);
                                            setLlmForm({ type: 'openai', model: 'gpt-4o', api_key: '', base_url: '', is_default: true });
                                        }}
                                        className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                            <button
                                onClick={handleLlmSubmit}
                                disabled={savingLLM}
                                className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {savingLLM ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingLLMId ? 'Update' : 'Create'} Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>

                        {/* List of Global LLM Configs */}
                        <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">Existing Global LLM Configurations</h3>
                                <button
                                    onClick={loadGlobalConfigs}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            {loading ? (
                                <div className="text-center py-8 text-zinc-400">Loading...</div>
                            ) : globalLLMConfigs.length === 0 ? (
                                <div className="text-center py-8 text-zinc-400">No global LLM configurations yet</div>
                            ) : (
                                <div className="space-y-3">
                                    {globalLLMConfigs.map((config, index) => (
                                        <div
                                            key={config.id || `llm-config-${index}`}
                                            className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-semibold text-white">{config.type} - {config.model}</span>
                                                    {config.active ? (
                                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 text-xs rounded-full">Inactive</span>
                                                    )}
                                                    {config.is_default && (
                                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Default</span>
                                                    )}
                                                    {config.has_api_key && (
                                                        <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">API Key Set</span>
                                                    )}
                                                </div>
                                                {config.base_url && (
                                                    <div className="text-sm text-zinc-400 mt-1">{config.base_url}</div>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleLLM(config.id)}
                                                    className={`p-2 rounded-lg transition-colors ${config.active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30'}`}
                                                    title={config.active ? 'Disable' : 'Enable'}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => startEditLLM(config)}
                                                    className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteLLM(config.id)}
                                                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {activeTab === 'embedding' && (
                    <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8 space-y-6"
                    >
                        <div className="flex items-start gap-4 p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl mb-6">
                            <ShieldAlert className="w-5 h-5 text-purple-400 shrink-0 mt-0.5" />
                            <div className="text-sm text-purple-200">
                                <strong>Global Embedding Configuration:</strong> These configurations are available to all users for RAG/document embeddings. Users can use them but cannot modify, delete, or disable them. Only superadmins can manage these.
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                            {editingEmbeddingId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5" />}
                            {editingEmbeddingId ? 'Edit' : 'Create'} Global Embedding Configuration
                        </h3>

                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Provider</label>
                                <select
                                    value={embeddingForm.provider}
                                    onChange={e => setEmbeddingForm({ ...embeddingForm, provider: e.target.value })}
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 text-white"
                                >
                                    <option value="openai">OpenAI</option>
                                    <option value="cohere">Cohere</option>
                                    <option value="huggingface">HuggingFace</option>
                                </select>
                            </div>
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Model Name</label>
                                <input
                                    type="text"
                                    value={embeddingForm.model}
                                    onChange={e => setEmbeddingForm({ ...embeddingForm, model: e.target.value })}
                                    placeholder="text-embedding-3-small"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 text-white"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm font-medium text-zinc-300">API Key</label>
                                <input
                                    type="password"
                                    value={embeddingForm.api_key}
                                    onChange={e => setEmbeddingForm({ ...embeddingForm, api_key: e.target.value })}
                                    placeholder="sk-... (leave empty to keep existing)"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 text-white"
                                />
                            </div>
                            <div className="col-span-2 space-y-2">
                                <label className="text-sm font-medium text-zinc-300">Base URL (Optional)</label>
                                <input
                                    type="text"
                                    value={embeddingForm.base_url}
                                    onChange={e => setEmbeddingForm({ ...embeddingForm, base_url: e.target.value })}
                                    placeholder="https://api.openai.com/v1"
                                    className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-purple-500/50 text-white"
                                />
                            </div>
                            <div className="col-span-2 flex items-center gap-3 p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                                <input
                                    type="checkbox"
                                    id="embedding_is_default"
                                    checked={embeddingForm.is_default}
                                    onChange={e => setEmbeddingForm({ ...embeddingForm, is_default: e.target.checked })}
                                    className="w-4 h-4 text-purple-600 bg-black/40 border-white/20 rounded focus:ring-purple-500"
                                />
                                <label htmlFor="embedding_is_default" className="text-sm font-medium text-zinc-300 cursor-pointer">
                                    Mark as Default Configuration
                                </label>
                                <span className="text-xs text-purple-400 ml-auto">
                                    Only one global config can be default. Setting this will unset others.
                                </span>
                            </div>
                        </div>

                        <div className="pt-4 flex justify-end gap-2">
                            {editingEmbeddingId && (
                                <button
                                    onClick={() => {
                                        setEditingEmbeddingId(null);
                                        setEmbeddingForm({ provider: 'openai', model: 'text-embedding-3-small', api_key: '', base_url: '', is_default: true });
                                    }}
                                    className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                            )}
                            <button
                                onClick={handleEmbeddingSubmit}
                                disabled={savingEmbedding}
                                className="px-6 py-2.5 bg-purple-600 hover:bg-purple-500 disabled:bg-purple-600/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                            >
                                {savingEmbedding ? (
                                    <>
                                        <RefreshCw className="w-4 h-4 animate-spin" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save className="w-4 h-4" />
                                        {editingEmbeddingId ? 'Update' : 'Create'} Configuration
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>

                    {/* List of Global Embedding Configs */}
                    <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8">
                        <div className="flex items-center justify-between mb-6">
                            <h3 className="text-lg font-bold text-white">Existing Global Embedding Configurations</h3>
                            <button
                                onClick={loadGlobalConfigs}
                                className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                title="Refresh"
                            >
                                <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                            </button>
                        </div>
                        {loading ? (
                            <div className="text-center py-8 text-zinc-400">Loading...</div>
                        ) : globalEmbeddingConfigs.length === 0 ? (
                            <div className="text-center py-8 text-zinc-400">No global embedding configurations yet</div>
                        ) : (
                            <div className="space-y-3">
                                {globalEmbeddingConfigs.map((config, index) => (
                                    <div
                                        key={config.id || `embedding-config-${index}`}
                                        className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between"
                                    >
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-semibold text-white">{config.provider} - {config.model}</span>
                                                {config.active ? (
                                                    <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                                                ) : (
                                                    <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 text-xs rounded-full">Inactive</span>
                                                )}
                                                {config.is_default && (
                                                    <span className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-xs rounded-full">Default</span>
                                                )}
                                                {config.has_api_key && (
                                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">API Key Set</span>
                                                )}
                                            </div>
                                            {config.base_url && (
                                                <div className="text-sm text-zinc-400 mt-1">{config.base_url}</div>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleToggleEmbedding(config.id)}
                                                className={`p-2 rounded-lg transition-colors ${config.active ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30'}`}
                                                title={config.active ? 'Disable' : 'Enable'}
                                            >
                                                <Power className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => startEditEmbedding(config)}
                                                className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                                                title="Edit"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEmbedding(config.id)}
                                                className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    </div>
                )}

                {activeTab === 'mcp' && (
                    <div className="space-y-6">
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                            className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8"
                        >
                            <div className="flex items-start gap-4 p-4 bg-green-500/5 border border-green-500/10 rounded-xl mb-6">
                                <ShieldAlert className="w-5 h-5 text-green-400 shrink-0 mt-0.5" />
                                <div className="text-sm text-green-200">
                                    <strong>Global MCP Servers:</strong> These servers are available to all users. Users can use them but cannot modify, delete, or disable them. Only superadmins can manage these.
                                </div>
                            </div>

                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                {editingMCPId ? <Edit2 className="w-5 h-5" /> : <Plus className="w-5 h-5 text-green-400" />}
                                {editingMCPId ? 'Edit' : 'Add'} Global MCP Server
                            </h3>
                            <div className="grid grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-300">Server Name</label>
                                    <input
                                        type="text"
                                        value={mcpForm.name}
                                        onChange={e => setMcpForm({ ...mcpForm, name: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500/50 text-white"
                                        placeholder="e.g. Weather Service"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-sm font-medium text-zinc-300">Connection Type</label>
                                    <select
                                        value={mcpForm.connection_type}
                                        onChange={e => setMcpForm({ ...mcpForm, connection_type: e.target.value as any })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500/50 text-white"
                                    >
                                        <option value="http">HTTP</option>
                                        <option value="sse">SSE (Server-Sent Events)</option>
                                        <option value="stdio">STDIO (Local Process)</option>
                                    </select>
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-zinc-300">Server URL</label>
                                    <input
                                        type="text"
                                        value={mcpForm.url}
                                        onChange={e => setMcpForm({ ...mcpForm, url: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500/50 text-white"
                                        placeholder={
                                            mcpForm.connection_type === 'http'
                                                ? "http://localhost:8000/api/mcp/people/mcp"
                                                : mcpForm.connection_type === 'sse'
                                                ? "http://localhost:3000/sse"
                                                : "npx -y @modelcontextprotocol/server-filesystem ..."
                                        }
                                    />
                                    {mcpForm.connection_type === 'http' && (
                                        <p className="text-xs text-zinc-400 mt-1">
                                            HTTP URLs should end with <code className="bg-zinc-800 px-1 rounded">/mcp</code>. Example: <code className="bg-zinc-800 px-1 rounded">http://localhost:8000/api/mcp/people/mcp</code>
                                        </p>
                                    )}
                                    {mcpForm.connection_type === 'sse' && (
                                        <p className="text-xs text-zinc-400 mt-1">
                                            SSE URLs should end with <code className="bg-zinc-800 px-1 rounded">/sse</code>. Example: <code className="bg-zinc-800 px-1 rounded">http://localhost:3000/sse</code>
                                        </p>
                                    )}
                                </div>
                                <div className="col-span-2 space-y-2">
                                    <label className="text-sm font-medium text-zinc-300">API Key (Optional)</label>
                                    <input
                                        type="password"
                                        value={mcpForm.api_key}
                                        onChange={e => setMcpForm({ ...mcpForm, api_key: e.target.value })}
                                        placeholder="Leave empty to keep existing"
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500/50 text-white"
                                    />
                                </div>
                            </div>
                            <div className="pt-6 flex justify-end gap-2">
                                {editingMCPId && (
                                    <button
                                        onClick={() => {
                                            setEditingMCPId(null);
                                            setMcpForm({ name: '', url: '', connection_type: 'http', api_key: '' });
                                        }}
                                        className="px-6 py-2.5 bg-zinc-700 hover:bg-zinc-600 text-white rounded-xl font-medium transition-colors"
                                    >
                                        Cancel
                                    </button>
                                )}
                                <button
                                    onClick={handleMcpSubmit}
                                    disabled={savingMCP}
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 disabled:bg-green-600/50 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                                >
                                    {savingMCP ? (
                                        <>
                                            <RefreshCw className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            <Server className="w-4 h-4" />
                                            {editingMCPId ? 'Update' : 'Deploy'} Global Server
                                        </>
                                    )}
                                </button>
                            </div>
                        </motion.div>

                        {/* List of Global MCP Servers */}
                        <div className="bg-zinc-900/50 backdrop-blur-sm border border-white/5 rounded-3xl p-8">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="text-lg font-bold text-white">Existing Global MCP Servers</h3>
                                <button
                                    onClick={loadGlobalConfigs}
                                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                                    title="Refresh"
                                >
                                    <RefreshCw className={`w-4 h-4 text-zinc-400 ${loading ? 'animate-spin' : ''}`} />
                                </button>
                            </div>
                            {loading ? (
                                <div className="text-center py-8 text-zinc-400">Loading...</div>
                            ) : globalMCPServers.length === 0 ? (
                                <div className="text-center py-8 text-zinc-400">No global MCP servers yet</div>
                            ) : (
                                <div className="space-y-3">
                                    {globalMCPServers.map((server, index) => (
                                        <div
                                            key={server.id || `mcp-server-${index}`}
                                            className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{server.name}</span>
                                                    {server.enabled ? (
                                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Enabled</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 text-xs rounded-full">Disabled</span>
                                                    )}
                                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full flex items-center gap-1">
                                                        <Lock className="w-3 h-3" />
                                                        Global
                                                    </span>
                                                </div>
                                                <div className="text-sm text-zinc-400 mt-1">{server.url} ({server.connection_type})</div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleToggleMCP(server.id)}
                                                    className={`p-2 rounded-lg transition-colors ${server.enabled ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30' : 'bg-zinc-500/20 text-zinc-400 hover:bg-zinc-500/30'}`}
                                                    title={server.enabled ? 'Disable' : 'Enable'}
                                                >
                                                    <Power className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => startEditMCP(server)}
                                                    className="p-2 bg-blue-500/20 text-blue-400 hover:bg-blue-500/30 rounded-lg transition-colors"
                                                    title="Edit"
                                                >
                                                    <Edit2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteMCP(server.id)}
                                                    className="p-2 bg-red-500/20 text-red-400 hover:bg-red-500/30 rounded-lg transition-colors"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
