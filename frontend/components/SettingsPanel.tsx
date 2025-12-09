import React, { useState, useEffect } from "react";
import {
  X,
  Settings,
  Server,
  Database,
  Key,
  Plus,
  Trash2,
  Check,
  RefreshCw,
  Edit2,
  Info as InfoIcon,
  Brain
} from "lucide-react";
import { useStore } from "@/lib/store";
import {
  listMCPServers,
  testMCPServerConnection,
  addMCPServer,
  updateMCPServer,
  deleteMCPServer,
  toggleMCPServer,
} from "@/lib/api/mcp";
import { type MCPServer } from "@/types/api/mcp";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import * as api from "@/lib/api";
import {
  listLLMConfigs,
} from "@/lib/api/llm";

export default function SettingsPanel() {
  const {
    settingsOpen,
    setSettingsOpen,
    mcpServers,
    loadMCPServers,
    llmConfig,
    loadLLMConfig,
    isAuthenticated,
  } = useStore();

  const [activeTab, setActiveTab] = useState<"general" | "llm" | "mcp" | "rag">("llm");
  const [isAddingServer, setIsAddingServer] = useState(false);
  const [editingServer, setEditingServer] = useState<string | null>(null);

  // LLM Config Form State
  const [llmForm, setLlmForm] = useState<{
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

  const [serverForm, setServerForm] = useState<{
    name: string;
    url: string;
    api_key?: string;
    connection_type: "stdio" | "http" | "sse";
    headers: Record<string, string>;
  }>({
    name: "",
    url: "",
    connection_type: "sse",
    headers: {},
  });

  const [isValidating, setIsValidating] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);

  // RAG Stats
  const [stats, setStats] = useState<{
    pending: number;
    needs_review: number;
    ready: number;
    error: number;
    total: number;
  }>({
    pending: 0,
    needs_review: 0,
    ready: 0,
    error: 0,
    total: 0,
  });

  const [refreshingStats, setRefreshingStats] = useState(false);

  // Load existing LLM config into form
  useEffect(() => {
    if (llmConfig) {
      setLlmForm({
        type: llmConfig.type,
        model: llmConfig.model,
        api_key: "", // API key is not returned for security, user must re-enter if changing
        api_base: llmConfig.api_base || "",
      });
    }
  }, [llmConfig]);

  // MCP Server Actions
  const handleValidateServer = async () => {
    setIsValidating(true);
    try {
      const { connected, message } = await api.testMCPServerConnection({
        name: serverForm.name,
        url: serverForm.url,
        connection_type: serverForm.connection_type,
        api_key: serverForm.api_key,
        headers: serverForm.headers
      });

      if (connected) {
        toast.success(message || "Connection successful");
      } else {
        toast.error(message || "Connection failed");
      }
    } catch (error) {
      toast.error("Validation failed");
    } finally {
      setIsValidating(false);
    }
  };

  const handleAddServer = async () => {
    try {
      await api.addMCPServer({
        name: serverForm.name,
        url: serverForm.url,
        connection_type: serverForm.connection_type,
        api_key: serverForm.api_key,
        headers: serverForm.headers
      });
      await loadMCPServers();
      toast.success("Server added successfully");
      setIsAddingServer(false);
      setServerForm({
        name: "",
        url: "",
        connection_type: "sse",
        headers: {},
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add server");
    }
  };

  const handleUpdateServer = async () => {
    if (!editingServer) return;
    try {
      await api.updateMCPServer(editingServer, {
        name: serverForm.name,
        url: serverForm.url,
        connection_type: serverForm.connection_type,
        api_key: serverForm.api_key,
        headers: serverForm.headers
      });
      await loadMCPServers();
      toast.success("Server updated successfully");
      setEditingServer(null);
    } catch (error) {
      toast.error("Failed to update server");
    }
  };

  const handleDeleteServer = async (name: string) => {
    if (!confirm("Are you sure you want to remove this server?")) return;
    try {
      await api.deleteMCPServer(name);
      await loadMCPServers();
      toast.success("Server removed");
    } catch (error) {
      toast.error("Failed to remove server");
    }
  };

  const startEditing = (server: MCPServer) => {
    setEditingServer(server.name);
    setIsAddingServer(false);
    setServerForm({
      name: server.name,
      url: server.url,
      connection_type: server.connection_type || "sse",
      headers: server.headers || {},
      api_key: "", // Security: Don't populate API key back
    });
  };

  // LLM Config Actions
  const handleSaveLLMConfig = async () => {
    try {
      await api.setLLMConfig(llmForm as any);
      await loadLLMConfig();
      toast.success("LLM Configuration saved");
    } catch (error) {
      toast.error("Failed to save LLM configuration");
    }
  };

  /**
   * Refreshes RAG statistics from the backend
   */
  const refreshStats = async () => {
    if (!isAuthenticated) return;

    setRefreshingStats(true);
    try {
      const newStats = await api.getReviewStatistics();
      setStats(newStats);
    } catch (error) {
      console.error("Failed to refresh stats:", error);
    } finally {
      setRefreshingStats(false);
    }
  };

  // Initial stats load
  useEffect(() => {
    if (activeTab === "rag" && isAuthenticated) {
      refreshStats();
      const interval = setInterval(refreshStats, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAuthenticated]);

  if (!settingsOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-zinc-950 border border-zinc-800 w-full max-w-4xl h-[85vh] rounded-2xl shadow-2xl flex overflow-hidden flex-col md:flex-row">

        {/* Sidebar */}
        <div className="w-full md:w-64 bg-zinc-900 border-b md:border-b-0 md:border-r border-zinc-800 p-4 flex flex-col">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Settings
          </h2>

          <nav className="space-y-1 flex-1">
            <button
              onClick={() => setActiveTab("llm")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "llm"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <Brain className="w-4 h-4" />
              LLM Provider
            </button>

            <button
              onClick={() => setActiveTab("mcp")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "mcp"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <Server className="w-4 h-4" />
              MCP Servers
            </button>

            <button
              onClick={() => setActiveTab("rag")}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                activeTab === "rag"
                  ? "bg-indigo-500/10 text-indigo-400"
                  : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
              )}
            >
              <Database className="w-4 h-4" />
              RAG & Knowledge
            </button>
          </nav>

          <div className="pt-4 border-t border-zinc-800 text-xs text-zinc-500">
            DosiBridge Agent v0.1.0
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex flex-col bg-zinc-950 max-h-full overflow-hidden">
          <div className="flex items-center justify-end p-4 border-b border-zinc-800">
            <button
              onClick={() => setSettingsOpen(false)}
              className="p-2 hover:bg-zinc-800 rounded-full text-zinc-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">

            {/* LLM Settings */}
            {activeTab === 'llm' && (
              <div className="max-w-xl mx-auto space-y-6">
                <div>
                  <h3 className="text-lg font-semibold text-white mb-1">LLM Configuration</h3>
                  <p className="text-sm text-zinc-400">Configure the AI model provider settings.</p>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Provider</label>
                    <select
                      value={llmForm.type}
                      onChange={(e) => setLlmForm({ ...llmForm, type: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                    >
                      <option value="openai">OpenAI</option>
                      <option value="anthropic">Anthropic</option>
                      <option value="gemini">Google Gemini</option>
                      <option value="ollama">Ollama (Local)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">Model Name</label>
                    <input
                      type="text"
                      value={llmForm.model}
                      onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="e.g. gpt-4o"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">API Key</label>
                    <div className="relative">
                      <input
                        type={showApiKey ? "text" : "password"}
                        value={llmForm.api_key}
                        onChange={(e) => setLlmForm({ ...llmForm, api_key: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none pr-10"
                        placeholder="sk-..."
                      />
                      <button
                        type="button"
                        onClick={() => setShowApiKey(!showApiKey)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white"
                      >
                        <Key className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-zinc-300 mb-1">API Base URL (Optional)</label>
                    <input
                      type="text"
                      value={llmForm.api_base}
                      onChange={(e) => setLlmForm({ ...llmForm, api_base: e.target.value })}
                      className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      placeholder="https://api.openai.com/v1"
                    />
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleSaveLLMConfig}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                      <Check className="w-4 h-4" />
                      Save Configuration
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MCP Settings */}
            {activeTab === 'mcp' && (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">MCP Servers</h3>
                    <p className="text-sm text-zinc-400">Manage Model Context Protocol servers.</p>
                  </div>
                  {!isAddingServer && !editingServer && (
                    <button
                      onClick={() => setIsAddingServer(true)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      Add Server
                    </button>
                  )}
                </div>

                {(isAddingServer || editingServer) ? (
                  <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
                    <h4 className="text-white font-medium mb-4">{editingServer ? 'Edit Server' : 'Add New Server'}</h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Name</label>
                        <input
                          value={serverForm.name}
                          onChange={(e) => setServerForm({ ...serverForm, name: e.target.value })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                          placeholder="My Server"
                          disabled={!!editingServer} // Cannot rename
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Connection Type</label>
                        <select
                          value={serverForm.connection_type}
                          onChange={(e) => setServerForm({ ...serverForm, connection_type: e.target.value as any })}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                        >
                          <option value="sse">SSE (Server-Sent Events)</option>
                          <option value="stdio">Stdio (Local Process)</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">URL / Command</label>
                      <input
                        value={serverForm.url}
                        onChange={(e) => setServerForm({ ...serverForm, url: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm"
                        placeholder={serverForm.connection_type === 'stdio' ? "npx -y @modelcontextprotocol/server-filesystem ..." : "http://localhost:3000/sse"}
                      />
                    </div>

                    <div className="pt-4 flex gap-3">
                      <button
                        onClick={editingServer ? handleUpdateServer : handleAddServer}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium"
                      >
                        {editingServer ? 'Update Server' : 'Add Server'}
                      </button>
                      <button
                        onClick={handleValidateServer}
                        disabled={isValidating}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        {isValidating && <RefreshCw className="w-3 h-3 animate-spin" />}
                        Test Connection
                      </button>
                      <button
                        onClick={() => {
                          setIsAddingServer(false);
                          setEditingServer(null);
                        }}
                        className="text-zinc-400 hover:text-white px-4 py-2 text-sm"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {mcpServers.map((server) => (
                      <div key={server.name} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                            <Server className="w-5 h-5" />
                          </div>
                          <div>
                            <h4 className="text-white font-medium">{server.name}</h4>
                            <div className="flex items-center gap-2 text-xs text-zinc-500">
                              <span className="uppercase bg-zinc-800 px-1.5 py-0.5 rounded text-[10px]">{server.connection_type || 'SSE'}</span>
                              <span className="truncate max-w-[200px]">{server.url}</span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => startEditing(server)}
                            className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDeleteServer(server.name)}
                            className="p-2 text-zinc-400 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {mcpServers.length === 0 && (
                      <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                        <p>No MCP servers configured.</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* RAG Content */}
            {activeTab === 'rag' && (
              <div className="space-y-6">
                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: "Total Documents", value: stats.total, color: "text-zinc-200" },
                    { label: "Ready", value: stats.ready, color: "text-green-400" },
                    { label: "Pending", value: stats.pending, color: "text-yellow-400" },
                    { label: "Needs Review", value: stats.needs_review, color: "text-red-400" },
                  ].map((stat, i) => (
                    <div key={i} className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-4">
                      <div className="text-sm text-zinc-500">{stat.label}</div>
                      <div className={`text-2xl font-semibold mt-1 ${stat.color}`}>{stat.value}</div>
                    </div>
                  ))}
                </div>

                <div className="p-4 bg-zinc-900/30 border border-zinc-800 rounded-xl text-center text-zinc-500">
                  <InfoIcon className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>RAG Configuration is managed via the backend.</p>
                </div>

                <div className="flex items-center justify-between text-xs text-zinc-500">
                  <button onClick={refreshStats} className="flex items-center gap-1 hover:text-white transition-colors">
                    <RefreshCw className={`w-3 h-3 ${refreshingStats ? 'animate-spin' : ''}`} />
                    Refresh Stats
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
