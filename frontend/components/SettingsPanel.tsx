/**
 * Settings panel component for MCP servers and LLM config
 * ChatGPT-like dark theme design
 */

'use client';

import {
    addMCPServer,
    deleteMCPServer,
    getToolsInfo,
    LLMConfig,
    MCPServerRequest,
    setLLMConfig,
    toggleMCPServer,
    ToolsInfo,
    updateMCPServer,
} from '@/lib/api';
import { useStore } from '@/lib/store';
import { AlertTriangle, Cpu, Edit2, Loader2, Plus, Save, Server, Trash2, Wrench, X } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
    const mcpServers = useStore((state) => state.mcpServers);
    const llmConfig = useStore((state) => state.llmConfig);
    const loadMCPServers = useStore((state) => state.loadMCPServers);
    const loadLLMConfig = useStore((state) => state.loadLLMConfig);

    const [toolsInfo, setToolsInfo] = useState<ToolsInfo | null>(null);
    const [activeTab, setActiveTab] = useState<'mcp' | 'llm' | 'tools'>('mcp');
    const [editingServer, setEditingServer] = useState<string | null>(null);
    const [deletingServer, setDeletingServer] = useState<string | null>(null);
    const [serverForm, setServerForm] = useState<MCPServerRequest>({ name: '', url: '', api_key: '' });
    const [llmForm, setLlmForm] = useState<LLMConfig>({
        type: 'openai',
        model: '',
        api_key: '',
        base_url: '',
    });

    const loadToolsInfo = useCallback(async () => {
        try {
            const info = await getToolsInfo();
            setToolsInfo(info);
        } catch (error) {
            console.error('Failed to load tools info:', error);
        }
    }, []);

    useEffect(() => {
        if (isOpen) {
            (async () => {
                try {
                    await loadMCPServers();
                    await loadLLMConfig();
                    await loadToolsInfo();
                } catch (error) {
                    console.error('Failed to load settings:', error);
                }
            })();
        }
    }, [isOpen, loadMCPServers, loadLLMConfig, loadToolsInfo]);

    // Close on Escape key
    useEffect(() => {
        const handleEscape = (e: globalThis.KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose();
            }
        };
        if (isOpen) {
            window.addEventListener('keydown', handleEscape);
            return () => window.removeEventListener('keydown', handleEscape);
        }
    }, [isOpen, onClose]);

    useEffect(() => {
        if (llmConfig) {
            const allowedTypes = ['openai', 'groq', 'ollama', 'gemini'] as LLMConfig['type'][];
            const type = allowedTypes.includes(llmConfig.type as LLMConfig['type'])
                ? (llmConfig.type as LLMConfig['type'])
                : 'openai';

            const t = setTimeout(() => {
                setLlmForm({
                    type,
                    model: llmConfig.model || '',
                    api_key: '',
                    base_url: llmConfig.base_url || '',
                    api_base: llmConfig.api_base || '',
                });
            }, 0);

            return () => clearTimeout(t);
        }
    }, [llmConfig]);

    const handleAddServer = async () => {
        if (!serverForm.name.trim() || !serverForm.url.trim()) {
            toast.error('Name and URL are required');
            return;
        }
        try {
            const serverToAdd: MCPServerRequest = {
                ...serverForm,
                enabled: true  // New servers are enabled by default
            };
            await addMCPServer(serverToAdd);
            toast.success('MCP server added');
            setServerForm({ name: '', url: '', api_key: '' });
            loadMCPServers();
        } catch (error) {
            toast.error(`Failed to add server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleUpdateServer = async (name: string) => {
        if (!serverForm.name.trim() || !serverForm.url.trim()) {
            toast.error('Name and URL are required');
            return;
        }
        try {
            const serverToUpdate: MCPServerRequest = {
                ...serverForm,
                enabled: serverForm.enabled !== false  // Ensure enabled is set
            };
            await updateMCPServer(name, serverToUpdate);
            toast.success('MCP server updated');
            setEditingServer(null);
            setServerForm({ name: '', url: '', api_key: '' });
            loadMCPServers();
        } catch (error) {
            toast.error(`Failed to update server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleDeleteServer = async (name: string) => {
        try {
            await deleteMCPServer(name);
            toast.success('MCP server deleted');
            setDeletingServer(null);
            loadMCPServers();
        } catch (error) {
            toast.error(`Failed to delete server: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const handleSaveLLMConfig = async () => {
        if (!llmForm.model.trim()) {
            toast.error('Model name is required');
            return;
        }
        if ((llmForm.type === 'openai' || llmForm.type === 'groq' || llmForm.type === 'gemini') && !llmForm.api_key?.trim()) {
            toast.error('API key is required for this LLM type');
            return;
        }
        try {
            await setLLMConfig(llmForm);
            toast.success('LLM configuration saved');
            loadLLMConfig();
        } catch (error) {
            toast.error(`Failed to save config: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    };

    const startEditServer = (server: typeof mcpServers[0]) => {
        setEditingServer(server.name);
        setServerForm({
            name: server.name,
            url: server.url,
            api_key: '',
            enabled: server.enabled !== false,  // Preserve enabled status
        });
    };

    if (!isOpen) return null;

    return (
        <>
            <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
                <div
                    className="bg-[#343541] rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col border border-gray-700"
                    onClick={(e) => e.stopPropagation()}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-gray-700">
                        <h2 className="text-xl font-semibold text-gray-200">Settings</h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-[#40414f] rounded-lg transition-colors"
                            aria-label="Close settings"
                        >
                            <X className="w-5 h-5 text-gray-400" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex border-b border-gray-700 bg-[#2d2d2f]">
                        <button
                            onClick={() => setActiveTab('mcp')}
                            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'mcp'
                                ? 'border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Server className="w-4 h-4" />
                            MCP Servers
                        </button>
                        <button
                            onClick={() => setActiveTab('llm')}
                            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'llm'
                                ? 'border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Cpu className="w-4 h-4" />
                            LLM Config
                        </button>
                        <button
                            onClick={() => setActiveTab('tools')}
                            className={`flex-1 px-6 py-3 font-medium text-sm transition-colors flex items-center justify-center gap-2 ${activeTab === 'tools'
                                ? 'border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Wrench className="w-4 h-4" />
                            Tools
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-6">
                        {activeTab === 'mcp' && (
                            <div className="space-y-6">
                                {/* Add/Edit Server Form */}
                                <div className="bg-[#40414f] rounded-lg p-5 border border-gray-700">
                                    <h3 className="text-lg font-semibold mb-4 text-gray-200">
                                        {editingServer ? 'Edit MCP Server' : 'Add MCP Server'}
                                    </h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-300">Name</label>
                                            <input
                                                type="text"
                                                value={serverForm.name}
                                                onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                placeholder="Server name"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-300">URL</label>
                                            <input
                                                type="text"
                                                value={serverForm.url}
                                                onChange={(e) => setServerForm({ ...serverForm, url: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                placeholder="http://localhost:8000/mcp"
                                            />
                                            <p className="text-xs text-gray-500 mt-1.5">URLs are automatically normalized to /mcp endpoint</p>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-300">API Key (optional)</label>
                                            <input
                                                type="password"
                                                value={serverForm.api_key}
                                                onChange={(e) => setServerForm({ ...serverForm, api_key: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                placeholder="Optional API key"
                                            />
                                        </div>
                                        <div className="flex gap-3">
                                            <button
                                                onClick={() => editingServer ? handleUpdateServer(editingServer) : handleAddServer()}
                                                className="flex-1 px-4 py-2.5 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                                            >
                                                {editingServer ? <Save className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                                                {editingServer ? 'Update Server' : 'Add Server'}
                                            </button>
                                            {editingServer && (
                                                <button
                                                    onClick={() => {
                                                        setEditingServer(null);
                                                        setServerForm({ name: '', url: '', api_key: '' });
                                                    }}
                                                    className="px-4 py-2.5 bg-[#40414f] hover:bg-[#2d2d2f] text-gray-300 rounded-lg transition-colors font-medium"
                                                >
                                                    Cancel
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Configured Servers List */}
                                <div>
                                    <h3 className="text-lg font-semibold mb-4 text-gray-200">Configured Servers</h3>
                                    <div className="space-y-2">
                                        {mcpServers.length === 0 ? (
                                            <div className="text-center py-12 px-4 bg-[#40414f] rounded-lg border border-gray-700">
                                                <Server className="w-12 h-12 mx-auto mb-3 text-gray-600" />
                                                <p className="text-sm text-gray-400">No MCP servers configured</p>
                                                <p className="text-xs text-gray-500 mt-1">Add a server above to get started</p>
                                            </div>
                                        ) : (
                                            mcpServers.map((server) => (
                                                <div
                                                    key={server.name}
                                                    className="flex items-center justify-between p-4 bg-[#40414f] border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                                                >
                                                    <div className="flex-1 min-w-0">
                                                        <div className="font-medium text-gray-200 mb-1">{server.name}</div>
                                                        <div className="text-sm text-gray-400 truncate">{server.url}</div>
                                                        {server.has_api_key && (
                                                            <div className="text-xs text-gray-500 mt-1">🔒 API key configured</div>
                                                        )}
                                                    </div>
                                                    <div className="flex gap-2 ml-4">
                                                        <button
                                                            onClick={() => startEditServer(server)}
                                                            className="p-2 hover:bg-[#343541] rounded-lg transition-colors"
                                                            aria-label={`Edit ${server.name}`}
                                                        >
                                                            <Edit2 className="w-4 h-4 text-gray-400 hover:text-[#10a37f]" />
                                                        </button>
                                                        <button
                                                            onClick={() => setDeletingServer(server.name)}
                                                            className="p-2 hover:bg-red-500/20 rounded-lg transition-colors"
                                                            aria-label={`Delete ${server.name}`}
                                                        >
                                                            <Trash2 className="w-4 h-4 text-red-400 hover:text-red-300" />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}

                        {activeTab === 'llm' && (
                            <div className="space-y-6">
                                {/* LLM Configuration Form */}
                                <div className="bg-[#40414f] rounded-lg p-5 border border-gray-700">
                                    <h3 className="text-lg font-semibold mb-4 text-gray-200">LLM Configuration</h3>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-300">Type</label>
                                            <select
                                                value={llmForm.type}
                                                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLlmForm({ ...llmForm, type: e.target.value as LLMConfig['type'] })}
                                                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                            >
                                                <option value="openai">OpenAI</option>
                                                <option value="groq">Groq</option>
                                                <option value="ollama">Ollama</option>
                                                <option value="gemini">Gemini</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium mb-2 text-gray-300">Model</label>
                                            <input
                                                type="text"
                                                value={llmForm.model}
                                                onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                                                className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                placeholder="gpt-4o, llama3.2, etc."
                                                required
                                            />
                                        </div>
                                        {(llmForm.type === 'openai' || llmForm.type === 'groq' || llmForm.type === 'gemini') && (
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-300">API Key</label>
                                                <input
                                                    type="password"
                                                    value={llmForm.api_key}
                                                    onChange={(e) => setLlmForm({ ...llmForm, api_key: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                    placeholder="sk-..."
                                                    required
                                                />
                                            </div>
                                        )}
                                        {llmForm.type === 'ollama' && (
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-300">Base URL</label>
                                                <input
                                                    type="text"
                                                    value={llmForm.base_url}
                                                    onChange={(e) => setLlmForm({ ...llmForm, base_url: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                    placeholder="http://localhost:11434"
                                                />
                                            </div>
                                        )}
                                        {llmForm.type === 'openai' && (
                                            <div>
                                                <label className="block text-sm font-medium mb-2 text-gray-300">API Base (optional)</label>
                                                <input
                                                    type="text"
                                                    value={llmForm.api_base || ''}
                                                    onChange={(e) => setLlmForm({ ...llmForm, api_base: e.target.value })}
                                                    className="w-full px-4 py-2.5 border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                                    placeholder="https://api.openai.com/v1"
                                                />
                                            </div>
                                        )}
                                        <button
                                            onClick={handleSaveLLMConfig}
                                            className="w-full px-4 py-2.5 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium"
                                        >
                                            <Save className="w-4 h-4" />
                                            Save Configuration
                                        </button>
                                    </div>
                                </div>

                                {/* Current Configuration */}
                                {llmConfig && (
                                    <div className="bg-[#40414f] rounded-lg p-5 border border-gray-700">
                                        <h3 className="text-lg font-semibold mb-4 text-gray-200">Current Configuration</h3>
                                        <div className="space-y-3">
                                            <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                                <span className="text-sm text-gray-400">Type:</span>
                                                <span className="text-sm font-medium text-gray-200">{llmConfig.type}</span>
                                            </div>
                                            <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                                <span className="text-sm text-gray-400">Model:</span>
                                                <span className="text-sm font-medium text-gray-200">{llmConfig.model}</span>
                                            </div>
                                            {llmConfig.base_url && (
                                                <div className="flex items-center justify-between py-2 border-b border-gray-700">
                                                    <span className="text-sm text-gray-400">Base URL:</span>
                                                    <span className="text-sm font-medium text-gray-200 truncate ml-4">{llmConfig.base_url}</span>
                                                </div>
                                            )}
                                            {llmConfig.has_api_key && (
                                                <div className="flex items-center justify-between py-2">
                                                    <span className="text-sm text-gray-400">API Key:</span>
                                                    <span className="text-sm font-medium text-green-400">✓ Configured</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'tools' && (
                            <div className="space-y-6">
                                <h3 className="text-lg font-semibold text-gray-200">Available Tools</h3>
                                {toolsInfo ? (
                                    <div className="space-y-6">
                                        <div>
                                            <h4 className="font-medium mb-3 text-gray-300 flex items-center gap-2">
                                                <Wrench className="w-4 h-4" />
                                                Local Tools
                                            </h4>
                                            <div className="space-y-2">
                                                {toolsInfo.local_tools.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500 text-sm">No local tools available</div>
                                                ) : (
                                                    toolsInfo.local_tools.map((tool) => (
                                                        <div key={tool.name} className="p-4 bg-[#40414f] border border-gray-700 rounded-lg">
                                                            <div className="font-medium text-gray-200 mb-1">{tool.name}</div>
                                                            <div className="text-sm text-gray-400 mb-2">{tool.description}</div>
                                                            <div className="text-xs text-gray-500">Type: {tool.type}</div>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <h4 className="font-medium mb-3 text-gray-300 flex items-center gap-2">
                                                <Server className="w-4 h-4" />
                                                MCP Servers
                                            </h4>
                                            <div className="space-y-2">
                                                {mcpServers.length === 0 ? (
                                                    <div className="text-center py-8 text-gray-500 text-sm">No MCP servers configured</div>
                                                ) : (
                                                    mcpServers.map((server) => (
                                                        <div key={server.name} className="p-4 bg-[#40414f] border border-gray-700 rounded-lg flex items-center justify-between">
                                                            <div className="flex-1 min-w-0">
                                                                <div className="font-medium text-gray-200 mb-1">{server.name}</div>
                                                                <div className="text-sm text-gray-400 mb-2 truncate">{server.url}</div>
                                                                <div className="text-xs text-gray-500">
                                                                    Status: <span className={server.enabled !== false ? 'text-green-400' : 'text-red-400'}>
                                                                        {server.enabled !== false ? 'Enabled' : 'Disabled'}
                                                                    </span>
                                                                </div>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer ml-4">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={server.enabled !== false}
                                                                    onChange={async (e) => {
                                                                        e.preventDefault();
                                                                        try {
                                                                            const result = await toggleMCPServer(server.name);
                                                                            // Backend returns {status, server, message}, TypeScript expects {server, message}
                                                                            const serverData = result.server;
                                                                            const newStatus = serverData?.enabled ? 'enabled' : 'disabled';
                                                                            toast.success(`MCP server ${newStatus}`);
                                                                            loadMCPServers();
                                                                        } catch (error) {
                                                                            toast.error(`Failed to toggle server: ${error instanceof Error ? error.message : 'Unknown error'}`);
                                                                        }
                                                                    }}
                                                                    className="sr-only peer"
                                                                />
                                                                <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#10a37f] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10a37f]"></div>
                                                            </label>
                                                        </div>
                                                    ))
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center py-12 text-gray-500">
                                        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-[#10a37f]" />
                                        <p className="text-sm">Loading tools information...</p>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Delete Server Confirmation Modal */}
            {deletingServer && (
                <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
                    <div className="bg-[#343541] rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
                        <div className="p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                                    <AlertTriangle className="w-5 h-5 text-red-400" />
                                </div>
                                <h3 className="text-lg font-semibold text-gray-200">Delete MCP Server</h3>
                            </div>
                            <p className="text-gray-300 mb-6">
                                Are you sure you want to delete <span className="font-medium text-white">{deletingServer}</span>? This action cannot be undone.
                            </p>
                            <div className="flex gap-3 justify-end">
                                <button
                                    onClick={() => setDeletingServer(null)}
                                    className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#40414f] rounded-lg transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => handleDeleteServer(deletingServer)}
                                    className="px-4 py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors"
                                >
                                    Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
