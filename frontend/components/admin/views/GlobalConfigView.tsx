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
    toggleGlobalLLMConfig
} from '@/lib/api/admin';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function GlobalConfigView() {
    const [activeTab, setActiveTab] = useState<'llm' | 'mcp'>('llm');
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
    const [editingMCPId, setEditingMCPId] = useState<number | null>(null);
    const [globalLLMConfigs, setGlobalLLMConfigs] = useState<any[]>([]);
    const [globalMCPServers, setGlobalMCPServers] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        loadGlobalConfigs();
    }, [activeTab]);

    const loadGlobalConfigs = async () => {
        setLoading(true);
        try {
            if (activeTab === 'llm') {
                const { configs } = await listGlobalLLMConfigs();
                setGlobalLLMConfigs(configs);
            } else {
                const { servers } = await listGlobalMCPServers();
                setGlobalMCPServers(servers);
            }
        } catch (error: any) {
            toast.error(`Failed to load global ${activeTab === 'llm' ? 'LLM configs' : 'MCP servers'}`);
        } finally {
            setLoading(false);
        }
    };

    const handleLlmSubmit = async () => {
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
            toast.error(error.message || "Failed to save global LLM config");
        }
    };

    const handleMcpSubmit = async () => {
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
            toast.error(error.message || "Failed to save global MCP server");
        }
    };

    const handleDeleteLLM = async (id: number) => {
        if (!confirm("Are you sure you want to delete this global LLM configuration?")) return;
        try {
            await deleteGlobalLLMConfig(id);
            toast.success("Global LLM configuration deleted");
            await loadGlobalConfigs();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete global LLM config");
        }
    };

    const handleDeleteMCP = async (id: number) => {
        if (!confirm("Are you sure you want to delete this global MCP server?")) return;
        try {
            await deleteGlobalMCPServer(id);
            toast.success("Global MCP server deleted");
            await loadGlobalConfigs();
        } catch (error: any) {
            toast.error(error.message || "Failed to delete global MCP server");
        }
    };

    const handleToggleLLM = async (id: number) => {
        try {
            await toggleGlobalLLMConfig(id);
            toast.success("Global LLM configuration status updated");
            await loadGlobalConfigs();
        } catch (error: any) {
            toast.error(error.message || "Failed to toggle global LLM config");
        }
    };

    const handleToggleMCP = async (id: number) => {
        try {
            await toggleGlobalMCPServer(id);
            toast.success("Global MCP server status updated");
            await loadGlobalConfigs();
        } catch (error: any) {
            toast.error(error.message || "Failed to toggle global MCP server");
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
                                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                                >
                                    <Save className="w-4 h-4" />
                                    {editingLLMId ? 'Update' : 'Create'} Configuration
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
                                    {globalLLMConfigs.map((config) => (
                                        <div
                                            key={config.id}
                                            className="bg-black/40 border border-white/10 rounded-xl p-4 flex items-center justify-between"
                                        >
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2">
                                                    <span className="font-semibold text-white">{config.type} - {config.model}</span>
                                                    {config.active ? (
                                                        <span className="px-2 py-0.5 bg-green-500/20 text-green-400 text-xs rounded-full">Active</span>
                                                    ) : (
                                                        <span className="px-2 py-0.5 bg-zinc-500/20 text-zinc-400 text-xs rounded-full">Inactive</span>
                                                    )}
                                                    {config.is_default && (
                                                        <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 text-xs rounded-full">Default</span>
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
                                    <label className="text-sm font-medium text-zinc-300">Server URL</label>
                                    <input
                                        type="text"
                                        value={mcpForm.url}
                                        onChange={e => setMcpForm({ ...mcpForm, url: e.target.value })}
                                        className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 outline-none focus:border-green-500/50 text-white"
                                        placeholder="http://localhost:8000/sse"
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
                                        <option value="sse">SSE</option>
                                        <option value="stdio">STDIO</option>
                                    </select>
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
                                    className="px-6 py-2.5 bg-green-600 hover:bg-green-500 text-white rounded-xl font-medium transition-colors flex items-center gap-2"
                                >
                                    <Server className="w-4 h-4" />
                                    {editingMCPId ? 'Update' : 'Deploy'} Global Server
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
                                    {globalMCPServers.map((server) => (
                                        <div
                                            key={server.id}
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
