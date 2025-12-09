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
  Brain,
  FileText,
  Loader2,
  Power
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
  switchLLMConfig,
  deleteLLMConfig,
  updateLLMConfig,
  type LLMConfigListItem,
} from "@/lib/api/llm";
import RAGUploadModal from "@/components/rag/RAGUploadModal";
import { Document } from "@/types/api";

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

  // RAG Stats & Documents
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

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(false);
  const [refreshingStats, setRefreshingStats] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);

  // LLM Configs List
  const [llmConfigs, setLlmConfigs] = useState<LLMConfigListItem[]>([]);
  const [loadingConfigs, setLoadingConfigs] = useState(false);
  const [editingLLMConfig, setEditingLLMConfig] = useState<number | null>(null);

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
      await loadLLMConfigsList();
      toast.success("LLM Configuration saved");
      // Reset form
      setLlmForm({
        type: "openai",
        model: "gpt-4o",
        api_key: "",
        api_base: "",
      });
      setEditingLLMConfig(null);
    } catch (error) {
      toast.error("Failed to save LLM configuration");
    }
  };

  const handleUpdateLLMConfig = async () => {
    if (!editingLLMConfig) return;
    try {
      await updateLLMConfig(editingLLMConfig, llmForm as any);
      await loadLLMConfig();
      await loadLLMConfigsList();
      toast.success("LLM Configuration updated successfully");
      // Reset form
      setLlmForm({
        type: "openai",
        model: "gpt-4o",
        api_key: "",
        api_base: "",
      });
      setEditingLLMConfig(null);
    } catch (error: any) {
      toast.error(error.message || "Failed to update LLM configuration");
    }
  };

  const startEditingLLMConfig = (config: LLMConfigListItem) => {
    setEditingLLMConfig(config.id);
    setLlmForm({
      type: config.type,
      model: config.model,
      api_key: "", // Security: Don't populate API key back
      api_base: config.api_base || "",
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const cancelEditingLLMConfig = () => {
    setEditingLLMConfig(null);
    setLlmForm({
      type: "openai",
      model: "gpt-4o",
      api_key: "",
      api_base: "",
    });
  };

  const loadLLMConfigsList = async () => {
    if (!isAuthenticated) return;
    setLoadingConfigs(true);
    try {
      const { configs } = await listLLMConfigs();
      setLlmConfigs(configs);
    } catch (error) {
      console.error("Failed to load LLM configs:", error);
      setLlmConfigs([]);
    } finally {
      setLoadingConfigs(false);
    }
  };

  const handleSwitchConfig = async (configId: number) => {
    try {
      await switchLLMConfig(configId);
      toast.success("Switched LLM configuration successfully");
      await loadLLMConfigsList();
      await loadLLMConfig();
    } catch (error: any) {
      toast.error(error.message || "Failed to switch LLM configuration");
    }
  };

  const handleDeleteConfig = async (configId: number) => {
    if (!confirm("Are you sure you want to delete this LLM configuration?")) {
      return;
    }
    try {
      await deleteLLMConfig(configId);
      toast.success("LLM configuration deleted successfully");
      await loadLLMConfigsList();
    } catch (error: any) {
      toast.error(error.message || "Failed to delete LLM configuration");
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

  const loadDocuments = async () => {
    if (!isAuthenticated) return;
    setLoadingDocs(true);
    try {
      const res = await api.listDocuments();
      setDocuments(res.documents);
    } catch (error) {
      console.error("Failed to load documents:", error);
    } finally {
      setLoadingDocs(false);
    }
  };

  const handleDeleteDocument = async (id: number) => {
    if (!confirm("Are you sure you want to delete this document? This cannot be undone.")) return;
    try {
      await api.deleteDocument(id);
      toast.success("Document deleted");
      loadDocuments();
      refreshStats();
    } catch (error) {
      toast.error("Failed to delete document");
    }
  };

  // Initial stats & docs load
  useEffect(() => {
    if (activeTab === "rag" && isAuthenticated) {
      refreshStats();
      loadDocuments();
      const interval = setInterval(() => {
        refreshStats();
        // Also refresh docs if there are pending ones to update status
        // But maybe checking stats is enough to trigger a reload?
        // simple approach: just reload both
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [activeTab, isAuthenticated]);

  // Load LLM configs when LLM tab is active
  useEffect(() => {
    if (activeTab === "llm" && isAuthenticated) {
      loadLLMConfigsList();
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
              <div className="space-y-6">
                {/* Add/Edit Configuration Form */}
                <div className="max-w-xl mx-auto space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">
                      {editingLLMConfig ? "Edit LLM Configuration" : "Add New LLM Configuration"}
                    </h3>
                    <p className="text-sm text-zinc-400">
                      {editingLLMConfig 
                        ? "Update your AI model provider configuration. Leave API key empty to keep existing key."
                        : "Configure a new AI model provider."}
                    </p>
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
                        <option value="deepseek">DeepSeek</option>
                        <option value="groq">Groq</option>
                        <option value="gemini">Google Gemini</option>
                        <option value="ollama">Ollama (Local)</option>
                        <option value="openrouter">OpenRouter</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-zinc-300 mb-1">Model Name</label>
                      <input
                        type="text"
                        value={llmForm.model}
                        onChange={(e) => setLlmForm({ ...llmForm, model: e.target.value })}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                        placeholder="e.g. gpt-4o, deepseek-chat, gemini-1.5-flash"
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

                    <div className={`pt-4 flex gap-2 ${editingLLMConfig ? "" : "flex-col"}`}>
                      {editingLLMConfig && (
                        <button
                          onClick={cancelEditingLLMConfig}
                          className="flex-1 bg-zinc-800 hover:bg-zinc-700 text-white font-medium py-2 rounded-lg transition-colors"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={editingLLMConfig ? handleUpdateLLMConfig : handleSaveLLMConfig}
                        className={`${editingLLMConfig ? "flex-1" : "w-full"} bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors flex items-center justify-center gap-2`}
                      >
                        <Check className="w-4 h-4" />
                        {editingLLMConfig ? "Update Configuration" : "Save Configuration"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Saved Configurations List */}
                {isAuthenticated && (
                  <div className="max-w-xl mx-auto space-y-4 mt-8">
                    <div>
                      <h3 className="text-lg font-semibold text-white mb-1">Saved LLM Configurations</h3>
                      <p className="text-sm text-zinc-400">Switch between or manage your saved LLM configurations.</p>
                    </div>

                    {loadingConfigs ? (
                      <div className="flex items-center justify-center p-8 bg-zinc-900/30 rounded-xl border border-zinc-800">
                        <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                      </div>
                    ) : llmConfigs.length > 0 ? (
                      <div className="space-y-3">
                        {llmConfigs.map((config) => (
                          <div
                            key={config.id}
                            className={cn(
                              "p-4 rounded-lg border",
                              config.active
                                ? "bg-indigo-500/10 border-indigo-500"
                                : "bg-zinc-900/30 border-zinc-800"
                            )}
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-2">
                                  <span className="text-sm font-semibold text-white capitalize">
                                    {config.type}
                                  </span>
                                  {config.active && (
                                    <span className="px-2 py-0.5 bg-indigo-500 text-white text-xs rounded-full flex items-center gap-1">
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
                                <div className="text-sm text-zinc-300 mb-1">
                                  Model: <span className="font-medium">{config.model}</span>
                                </div>
                                <div className="flex items-center gap-4 text-xs text-zinc-500">
                                  <span>
                                    API Key:{" "}
                                    {config.has_api_key ? (
                                      <span className="text-green-400">✓ Set</span>
                                    ) : (
                                      <span className="text-red-500">✗ Not set</span>
                                    )}
                                  </span>
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
                                {!config.is_default && (
                                  <button
                                    onClick={() => startEditingLLMConfig(config)}
                                    className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                                    title="Edit this LLM configuration"
                                  >
                                    <Edit2 className="w-4 h-4 text-indigo-400" />
                                  </button>
                                )}
                                {!config.active && (
                                  <button
                                    onClick={() => handleSwitchConfig(config.id)}
                                    className="p-2 bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 rounded-lg transition-colors"
                                    title="Switch to this LLM"
                                  >
                                    <Power className="w-4 h-4 text-indigo-400" />
                                  </button>
                                )}
                                {!config.active && !config.is_default && (
                                  <button
                                    onClick={() => handleDeleteConfig(config.id)}
                                    className="p-2 bg-zinc-800 hover:bg-red-500/10 border border-zinc-700 rounded-lg transition-colors"
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
                      <div className="text-center py-8 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                        <Brain className="w-12 h-12 mx-auto mb-3 opacity-50" />
                        <p>No LLM configurations found. Add one above.</p>
                      </div>
                    )}
                  </div>
                )}
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
                {/* Header & Upload */}
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-white">Knowledge Base</h3>
                    <p className="text-sm text-zinc-400">Manage your documents and RAG settings.</p>
                  </div>
                  <button
                    onClick={() => setShowUploadModal(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Upload Document
                  </button>
                </div>

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

                {/* Document List */}
                <div className="space-y-4">
                  <h4 className="text-sm font-medium text-zinc-300">Documents</h4>

                  {loadingDocs ? (
                    <div className="flex items-center justify-center p-8 bg-zinc-900/30 rounded-xl border border-zinc-800">
                      <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                    </div>
                  ) : documents.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                      {documents.map((doc) => (
                        <div key={doc.id} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 shrink-0">
                              <FileText className="w-5 h-5" />
                            </div>
                            <div className="min-w-0">
                              <h5 className="text-white font-medium truncate max-w-[200px] sm:max-w-xs">{doc.original_filename}</h5>
                              <div className="flex items-center gap-2 text-xs text-zinc-500">
                                <span className={cn(
                                  "capitalize px-1.5 py-0.5 rounded text-[10px]",
                                  doc.status === 'ready' ? "bg-green-500/10 text-green-400" :
                                    doc.status === 'pending' || doc.status === 'processing' ? "bg-yellow-500/10 text-yellow-400" :
                                      "bg-zinc-800 text-zinc-400"
                                )}>
                                  {doc.status}
                                </span>
                                <span>{(doc.file_size / 1024).toFixed(1)} KB</span>
                                <span>•</span>
                                <span>{new Date(doc.created_at || new Date()).toLocaleDateString()}</span>
                              </div>
                            </div>
                          </div>

                          <button
                            onClick={() => handleDeleteDocument(doc.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                            title="Delete document"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                      <p>No documents uploaded yet.</p>
                      <button onClick={() => setShowUploadModal(true)} className="text-indigo-400 hover:text-indigo-300 text-sm mt-2">
                        Upload your first document
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      <RAGUploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUploadComplete={() => {
          loadDocuments();
          refreshStats();
        }}
      />
    </div>
  );
}
