/**
 * Settings panel component for MCP servers and LLM config
 * ChatGPT-like dark theme design
 */

"use client";

import {
  addMCPServer,
  deleteMCPServer,
  getToolsInfo,
  LLMConfig,
  MCPServerRequest,
  resetLLMConfig,
  setLLMConfig,
  testMCPServerConnection,
  toggleMCPServer,
  ToolsInfo,
  updateMCPServer,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  AlertTriangle,
  CheckCircle,
  Edit2,
  Eye,
  EyeOff,
  FileJson,
  Loader2,
  Lock,
  Plus,
  Save,
  Server,
  Trash2,
  Wifi,
  WifiOff,
  Wrench,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const mcpServers = useStore((state) => state.mcpServers);
  const llmConfig = useStore((state) => state.llmConfig);
  const loadMCPServers = useStore((state) => state.loadMCPServers);
  const loadLLMConfig = useStore((state) => state.loadLLMConfig);

  const [toolsInfo, setToolsInfo] = useState<ToolsInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"mcp" | "llm" | "tools">("mcp");
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [serverForm, setServerForm] = useState<MCPServerRequest>({
    name: "",
    url: "",
    connection_type: "http",
    api_key: "",
    headers: {},
  });
  const [headerPairs, setHeaderPairs] = useState<
    Array<{ key: string; value: string; enabled: boolean }>
  >([]);
  const [headerJsonMode, setHeaderJsonMode] = useState(false);
  const [headerJsonText, setHeaderJsonText] = useState("{}");
  const [headerVisibility, setHeaderVisibility] = useState<
    Record<number, boolean>
  >({});
  const [testingConnection, setTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    connected: boolean;
    message: string;
  } | null>(null);
  const [llmForm, setLlmForm] = useState<LLMConfig>({
    type: "gemini",
    model: "",
    api_key: "",
    base_url: "",
  });

  const loadToolsInfo = useCallback(async () => {
    try {
      const info = await getToolsInfo();
      setToolsInfo(info);
    } catch (error) {
      console.error("Failed to load tools info:", error);
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
          console.error("Failed to load settings:", error);
        }
      })();
    }
  }, [isOpen, loadMCPServers, loadLLMConfig, loadToolsInfo]);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener("keydown", handleEscape);
      return () => window.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (llmConfig) {
      const allowedTypes = [
        "openai",
        "groq",
        "ollama",
        "gemini",
      ] as LLMConfig["type"][];
      const type = allowedTypes.includes(llmConfig.type as LLMConfig["type"])
        ? (llmConfig.type as LLMConfig["type"])
        : "gemini";

      const t = setTimeout(() => {
        setLlmForm({
          type,
          model: llmConfig.model || "",
          api_key: "",
          base_url: llmConfig.base_url || "",
          api_base: llmConfig.api_base || "",
        });
      }, 0);

      return () => clearTimeout(t);
    }
  }, [llmConfig]);

  const handleTestConnection = async () => {
    // Sync headers before testing
    updateHeadersFromPairs();
    if (!serverForm.url.trim()) {
      toast.error("URL is required to test connection");
      return;
    }
    setTestingConnection(true);
    setConnectionStatus(null);
    try {
      const serverToTest: MCPServerRequest = {
        ...serverForm,
        headers: buildHeadersFromPairs(),
        enabled: true,
      };
      const result = await testMCPServerConnection(serverToTest);
      setConnectionStatus({
        connected: result.connected,
        message: result.message,
      });
      if (result.connected) {
        toast.success("Connection successful!");
      } else {
        toast.error(`Connection failed: ${result.message}`);
      }
    } catch (error) {
      setConnectionStatus({
        connected: false,
        message:
          error instanceof Error ? error.message : "Connection test failed",
      });
      toast.error(
        `Connection test failed: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    } finally {
      setTestingConnection(false);
    }
  };

  // Build headers object from headerPairs (only enabled ones with both key and value)
  const buildHeadersFromPairs = (): Record<string, string> | undefined => {
    const headers: Record<string, string> = {};
    headerPairs.forEach((pair) => {
      if (pair.enabled && pair.key.trim() && pair.value.trim()) {
        headers[pair.key.trim()] = pair.value;
      }
    });
    return Object.keys(headers).length > 0 ? headers : undefined;
  };

  // Sync JSON text to headerPairs
  const syncJsonToPairs = () => {
    try {
      const parsed = JSON.parse(headerJsonText);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        const pairs = Object.entries(parsed).map(([key, value]) => ({
          key,
          value: String(value),
          enabled: true,
        }));
        setHeaderPairs(
          pairs.length > 0 ? pairs : [{ key: "", value: "", enabled: true }]
        );
      }
    } catch (e) {
      toast.error("Invalid JSON format");
    }
  };

  // Sync headerPairs to JSON text
  const syncPairsToJson = () => {
    const headers = buildHeadersFromPairs() || {};
    setHeaderJsonText(JSON.stringify(headers, null, 2));
  };

  // Sync headerPairs to serverForm.headers
  const updateHeadersFromPairs = () => {
    // If in JSON mode, sync JSON to pairs first
    if (headerJsonMode) {
      syncJsonToPairs();
      setHeaderJsonMode(false);
    }
    const headers = buildHeadersFromPairs();
    setServerForm({ ...serverForm, headers });
  };

  const handleAddServer = async () => {
    if (!serverForm.name.trim() || !serverForm.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }

    // Sync headers before testing
    updateHeadersFromPairs();

    // Test connection before adding
    setTestingConnection(true);
    try {
      const serverToTest: MCPServerRequest = {
        ...serverForm,
        headers: buildHeadersFromPairs(),
        enabled: true,
      };
      const testResult = await testMCPServerConnection(serverToTest);

      if (!testResult.connected) {
        toast.error(`Cannot add server: ${testResult.message}`);
        setConnectionStatus({
          connected: false,
          message: testResult.message,
        });
        setTestingConnection(false);
        return;
      }

      // Connection successful, proceed to add
      const serverToAdd: MCPServerRequest = {
        ...serverForm,
        headers: buildHeadersFromPairs(),
        enabled: true, // New servers are enabled by default
      };
      await addMCPServer(serverToAdd);
      toast.success("MCP server added successfully");
      setServerForm({
        name: "",
        url: "",
        connection_type: "http",
        api_key: "",
        headers: {},
      });
      setHeaderPairs([]);
      setHeaderJsonText("{}");
      setHeaderJsonMode(false);
      setHeaderVisibility({});
      setConnectionStatus(null);
      loadMCPServers();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("Connection test failed")) {
        toast.error(`Cannot add server: ${errorMessage}`);
      } else {
        toast.error(`Failed to add server: ${errorMessage}`);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleUpdateServer = async (name: string) => {
    if (!name || !name.trim()) {
      toast.error("Server name is required");
      return;
    }
    if (!serverForm.name.trim() || !serverForm.url.trim()) {
      toast.error("Name and URL are required");
      return;
    }

    // Sync headers before testing
    updateHeadersFromPairs();

    // Test connection before updating (if URL or API key changed)
    setTestingConnection(true);
    try {
      const serverToTest: MCPServerRequest = {
        ...serverForm,
        headers: buildHeadersFromPairs(),
        enabled: serverForm.enabled !== false,
      };
      const testResult = await testMCPServerConnection(serverToTest);

      if (!testResult.connected) {
        toast.error(`Cannot update server: ${testResult.message}`);
        setConnectionStatus({
          connected: false,
          message: testResult.message,
        });
        setTestingConnection(false);
        return;
      }

      // Connection successful, proceed to update
      const serverToUpdate: MCPServerRequest = {
        ...serverForm,
        headers: buildHeadersFromPairs(),
        enabled: serverForm.enabled !== false, // Ensure enabled is set
      };
      await updateMCPServer(name, serverToUpdate);
      toast.success("MCP server updated successfully");
      setEditingServer(null);
      setServerForm({
        name: "",
        url: "",
        connection_type: "http",
        api_key: "",
        headers: {},
      });
      setHeaderPairs([]);
      setHeaderJsonText("{}");
      setHeaderJsonMode(false);
      setHeaderVisibility({});
      setConnectionStatus(null);
      loadMCPServers();
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      if (errorMessage.includes("Connection test failed")) {
        toast.error(`Cannot update server: ${errorMessage}`);
      } else {
        toast.error(`Failed to update server: ${errorMessage}`);
      }
    } finally {
      setTestingConnection(false);
    }
  };

  const handleDeleteServer = async (name: string) => {
    if (!name || !name.trim()) {
      toast.error("Server name is required");
      setDeletingServer(null);
      return;
    }
    try {
      await deleteMCPServer(name);
      toast.success("MCP server deleted");
      setDeletingServer(null);
      loadMCPServers();
    } catch (error) {
      toast.error(
        `Failed to delete server: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
      setDeletingServer(null);
    }
  };

  const handleSaveLLMConfig = async () => {
    if (!llmForm.model.trim()) {
      toast.error("Model name is required");
      return;
    }
    if (
      (llmForm.type === "openai" ||
        llmForm.type === "groq" ||
        llmForm.type === "gemini") &&
      !llmForm.api_key?.trim()
    ) {
      toast.error("API key is required for this LLM type");
      return;
    }
    try {
      await setLLMConfig(llmForm);
      toast.success("LLM configuration saved");
      loadLLMConfig();
    } catch (error) {
      toast.error(
        `Failed to save config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const handleResetLLMConfig = async () => {
    if (
      !confirm(
        "Reset LLM configuration to default OpenAI GPT settings? This will replace your current configuration."
      )
    ) {
      return;
    }
    try {
      await resetLLMConfig();
      toast.success("LLM configuration reset to default OpenAI GPT");
      loadLLMConfig();
      // Update form to show default values
      setLlmForm({
        type: "openai",
        model: "gpt-4o",
        api_key: "",
        base_url: "",
      });
    } catch (error) {
      toast.error(
        `Failed to reset config: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  };

  const startEditServer = (server: (typeof mcpServers)[0]) => {
    setEditingServer(server.name);
    const headers = server.headers || {};
    const pairs = Object.entries(headers).map(([key, value]) => ({
      key,
      value: String(value),
      enabled: true,
    }));
    setHeaderPairs(
      pairs.length > 0 ? pairs : [{ key: "", value: "", enabled: true }]
    );
    setHeaderJsonText(JSON.stringify(headers, null, 2));
    setHeaderJsonMode(false);
    setHeaderVisibility({});
    setServerForm({
      name: server.name,
      url: server.url,
      connection_type: server.connection_type || "http",
      api_key: "",
      headers: headers,
      enabled: server.enabled !== false, // Preserve enabled status
    });
  };

  if (!isOpen) return null;

  // Show login prompt if not authenticated
  if (!isAuthenticated) {
    return (
      <>
        <div
          className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4"
          onClick={onClose}
        >
          <div
            className="bg-[#343541] rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-gray-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 text-center">
              <div className="mb-6 flex justify-center">
                <div className="p-4 bg-[#40414f] rounded-full">
                  <Lock className="w-12 h-12 text-[#10a37f]" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-white mb-3">
                Authentication Required
              </h2>
              <p className="text-gray-400 mb-6">
                Please log in or create an account to access MCP server
                configuration and model settings.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button
                  onClick={() => {
                    onClose();
                    const event = new CustomEvent("open-auth", {
                      detail: { mode: "login" },
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-6 py-2.5 bg-[#10a37f] hover:bg-[#0d8f6e] text-white font-medium rounded-lg transition-colors"
                >
                  Log in
                </button>
                <button
                  onClick={() => {
                    onClose();
                    const event = new CustomEvent("open-auth", {
                      detail: { mode: "register" },
                    });
                    window.dispatchEvent(event);
                  }}
                  className="px-6 py-2.5 bg-[#40414f] hover:bg-[#2d2d2f] text-white font-medium rounded-lg transition-colors border border-gray-600"
                >
                  Create account
                </button>
              </div>
              <button
                onClick={onClose}
                className="mt-4 text-gray-400 hover:text-gray-300 text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4"
        onClick={onClose}
      >
        <div
          className="bg-[#343541] rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-700 shrink-0">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-200">
              Settings
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[#40414f] rounded-lg transition-colors touch-manipulation"
              aria-label="Close settings"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-gray-700 bg-[#2d2d2f] shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation ${
                activeTab === "mcp"
                  ? "border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">MCP Servers</span>
            </button>
            {/* LLM Config tab disabled */}
            {/* <button
                            onClick={() => setActiveTab('llm')}
                            className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation ${activeTab === 'llm'
                                ? 'border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]'
                                : 'text-gray-400 hover:text-gray-200'
                                }`}
                        >
                            <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="truncate">LLM Config</span>
                        </button> */}
            <button
              onClick={() => setActiveTab("tools")}
              className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation ${
                activeTab === "tools"
                  ? "border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]"
                  : "text-gray-400 hover:text-gray-200"
              }`}
            >
              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
              <span className="truncate">Tools</span>
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            {activeTab === "mcp" && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* Add/Edit Server Form */}
                <div className="bg-[#40414f] rounded-lg p-4 sm:p-5 border border-gray-700">
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-200">
                    {editingServer ? "Edit MCP Server" : "Add MCP Server"}
                  </h3>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-300">
                        Name
                      </label>
                      <input
                        type="text"
                        value={serverForm.name}
                        onChange={(e) =>
                          setServerForm({ ...serverForm, name: e.target.value })
                        }
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                        placeholder="Server name"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-300">
                        Connection Type
                      </label>
                      <select
                        value={serverForm.connection_type || "http"}
                        onChange={(e) => {
                          setServerForm({
                            ...serverForm,
                            connection_type: e.target.value as
                              | "stdio"
                              | "http"
                              | "sse",
                          });
                          setConnectionStatus(null); // Clear status when connection type changes
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-600 rounded-lg bg-[#343541] text-gray-100 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                      >
                        <option value="http">HTTP</option>
                        <option value="sse">SSE (Server-Sent Events)</option>
                        <option value="stdio">STDIO (Command)</option>
                      </select>
                      <p className="text-xs text-gray-500 mt-1 sm:mt-1.5">
                        {serverForm.connection_type === "stdio"
                          ? "Enter the command to run (e.g., 'npx @modelcontextprotocol/server-filesystem /path')"
                          : serverForm.connection_type === "sse"
                          ? "URL will be normalized to /sse endpoint"
                          : "URL will be normalized to /mcp endpoint"}
                      </p>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-300">
                        {serverForm.connection_type === "stdio"
                          ? "Command"
                          : "URL"}
                      </label>
                      <input
                        type="text"
                        value={serverForm.url}
                        onChange={(e) => {
                          setServerForm({ ...serverForm, url: e.target.value });
                          setConnectionStatus(null); // Clear status when URL changes
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                        placeholder={
                          serverForm.connection_type === "stdio"
                            ? "npx @modelcontextprotocol/server-filesystem /path"
                            : serverForm.connection_type === "sse"
                            ? "http://localhost:8000/api/mcp/server/sse"
                            : "http://localhost:8000/api/mcp/server/mcp"
                        }
                      />
                      {serverForm.connection_type !== "stdio" && (
                        <p className="text-xs text-gray-500 mt-1 sm:mt-1.5">
                          {serverForm.connection_type === "sse"
                            ? "URLs are automatically normalized to /sse endpoint"
                            : "URLs are automatically normalized to /mcp endpoint"}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-gray-300">
                        API Key (optional)
                      </label>
                      <input
                        type="password"
                        value={serverForm.api_key}
                        onChange={(e) => {
                          setServerForm({
                            ...serverForm,
                            api_key: e.target.value,
                          });
                          setConnectionStatus(null); // Clear status when API key changes
                        }}
                        className="w-full px-3 sm:px-4 py-2 sm:py-2.5 text-sm sm:text-base border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                        placeholder="Optional API key"
                      />
                    </div>

                    {/* Authentication Section */}
                    <div className="border-t border-gray-700 pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-sm font-semibold text-gray-200">
                          Authentication
                        </h4>
                      </div>

                      {/* Custom Headers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs sm:text-sm font-medium text-gray-300">
                            Custom Headers
                          </label>
                          <div className="flex gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                if (headerJsonMode) {
                                  syncJsonToPairs();
                                  setHeaderJsonMode(false);
                                } else {
                                  syncPairsToJson();
                                  setHeaderJsonMode(true);
                                }
                              }}
                              className={`px-3 py-1.5 text-xs border rounded-lg transition-colors flex items-center gap-1.5 ${
                                headerJsonMode
                                  ? "bg-[#10a37f] border-[#10a37f] text-white"
                                  : "bg-[#40414f] border-gray-600 text-gray-300 hover:bg-[#2d2d2f]"
                              }`}
                            >
                              <FileJson className="w-3.5 h-3.5" />
                              JSON
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (headerJsonMode) {
                                  setHeaderJsonText("{}");
                                } else {
                                  setHeaderPairs([
                                    ...headerPairs,
                                    { key: "", value: "", enabled: true },
                                  ]);
                                }
                              }}
                              className="px-3 py-1.5 text-xs bg-[#40414f] border border-gray-600 text-gray-300 rounded-lg hover:bg-[#2d2d2f] transition-colors flex items-center gap-1.5"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              Add
                            </button>
                          </div>
                        </div>

                        {headerJsonMode ? (
                          <div>
                            <textarea
                              value={headerJsonText}
                              onChange={(e) =>
                                setHeaderJsonText(e.target.value)
                              }
                              className="w-full px-3 py-2 text-sm border border-gray-600 rounded-lg bg-[#343541] text-gray-100 font-mono focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f] min-h-[120px]"
                              placeholder='{\n  "Authorization": "Bearer token",\n  "X-Custom-Header": "value"\n}'
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {headerPairs.length === 0 ? (
                              <div className="text-center py-4 text-sm text-gray-500">
                                No headers added. Click "+ Add" to add a header.
                              </div>
                            ) : (
                              headerPairs.map((pair, index) => (
                                <div key={index} className="space-y-2">
                                  <div className="flex items-center gap-3">
                                    {/* Toggle Switch */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newPairs = [...headerPairs];
                                        newPairs[index].enabled =
                                          !newPairs[index].enabled;
                                        setHeaderPairs(newPairs);
                                      }}
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:ring-offset-2 focus:ring-offset-[#343541] ${
                                        pair.enabled
                                          ? "bg-[#10a37f]"
                                          : "bg-gray-600"
                                      }`}
                                      role="switch"
                                      aria-checked={pair.enabled}
                                    >
                                      <span
                                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                          pair.enabled
                                            ? "translate-x-5"
                                            : "translate-x-1"
                                        }`}
                                      />
                                    </button>

                                    {/* Header Name */}
                                    <input
                                      type="text"
                                      value={pair.key}
                                      onChange={(e) => {
                                        const newPairs = [...headerPairs];
                                        newPairs[index].key = e.target.value;
                                        setHeaderPairs(newPairs);
                                      }}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                      placeholder="Header Name"
                                    />

                                    {/* Delete Button */}
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const newPairs = headerPairs.filter(
                                          (_, i) => i !== index
                                        );
                                        setHeaderPairs(
                                          newPairs.length > 0 ? newPairs : []
                                        );
                                      }}
                                      className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                                      aria-label="Remove header"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>

                                  {/* Header Value */}
                                  <div className="flex items-center gap-2 ml-8">
                                    <input
                                      type={
                                        headerVisibility[index]
                                          ? "text"
                                          : "password"
                                      }
                                      value={pair.value}
                                      onChange={(e) => {
                                        const newPairs = [...headerPairs];
                                        newPairs[index].value = e.target.value;
                                        setHeaderPairs(newPairs);
                                      }}
                                      className="flex-1 px-3 py-2 text-sm border border-gray-600 rounded-lg bg-[#343541] text-gray-100 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#10a37f] focus:border-[#10a37f]"
                                      placeholder="Header Value"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHeaderVisibility({
                                          ...headerVisibility,
                                          [index]: !headerVisibility[index],
                                        });
                                      }}
                                      className="p-2 text-gray-400 hover:text-gray-200 transition-colors"
                                      aria-label={
                                        headerVisibility[index]
                                          ? "Hide value"
                                          : "Show value"
                                      }
                                    >
                                      {headerVisibility[index] ? (
                                        <EyeOff className="w-4 h-4" />
                                      ) : (
                                        <Eye className="w-4 h-4" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                              ))
                            )}
                          </div>
                        )}

                        <p className="text-xs text-gray-500 mt-3">
                          Use the toggle to enable/disable headers. Only enabled
                          headers with both name and value will be sent.
                        </p>
                      </div>
                    </div>

                    {/* Connection Status */}
                    {connectionStatus && (
                      <div
                        className={`p-3 rounded-lg border flex items-start gap-2 ${
                          connectionStatus.connected
                            ? "bg-green-900/20 border-green-700 text-green-300"
                            : "bg-red-900/20 border-red-700 text-red-300"
                        }`}
                      >
                        {connectionStatus.connected ? (
                          <CheckCircle className="w-5 h-5 shrink-0 mt-0.5" />
                        ) : (
                          <WifiOff className="w-5 h-5 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1">
                          <p className="text-sm font-medium">
                            {connectionStatus.connected
                              ? "Connection Successful"
                              : "Connection Failed"}
                          </p>
                          <p className="text-xs mt-1 opacity-90">
                            {connectionStatus.message}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                      <button
                        onClick={handleTestConnection}
                        disabled={!serverForm.url.trim() || testingConnection}
                        className="px-4 py-2.5 bg-[#40414f] hover:bg-[#2d2d2f] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base touch-manipulation"
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            <Wifi className="w-4 h-4 shrink-0" />
                            <span>Test Connection</span>
                          </>
                        )}
                      </button>
                      <button
                        onClick={() =>
                          editingServer
                            ? handleUpdateServer(editingServer)
                            : handleAddServer()
                        }
                        disabled={testingConnection}
                        className="flex-1 px-4 py-2.5 bg-[#10a37f] hover:bg-[#0d8f6e] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-colors flex items-center justify-center gap-2 font-medium text-sm sm:text-base touch-manipulation"
                      >
                        {testingConnection ? (
                          <>
                            <Loader2 className="w-4 h-4 shrink-0 animate-spin" />
                            <span>Testing...</span>
                          </>
                        ) : (
                          <>
                            {editingServer ? (
                              <Save className="w-4 h-4 shrink-0" />
                            ) : (
                              <Plus className="w-4 h-4 shrink-0" />
                            )}
                            <span>
                              {editingServer ? "Update Server" : "Add Server"}
                            </span>
                          </>
                        )}
                      </button>
                      {editingServer && (
                        <button
                          onClick={() => {
                            setEditingServer(null);
                            setServerForm({
                              name: "",
                              url: "",
                              connection_type: "http",
                              api_key: "",
                              headers: {},
                            });
                            setHeaderPairs([]);
                            setHeaderJsonText("{}");
                            setHeaderJsonMode(false);
                            setHeaderVisibility({});
                            setConnectionStatus(null);
                          }}
                          disabled={testingConnection}
                          className="w-full sm:w-auto px-4 py-2.5 bg-[#40414f] hover:bg-[#2d2d2f] disabled:opacity-50 disabled:cursor-not-allowed text-gray-300 rounded-lg transition-colors font-medium text-sm sm:text-base touch-manipulation"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Configured Servers List */}
                <div>
                  <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-200">
                    Configured Servers
                  </h3>
                  <div className="space-y-2">
                    {mcpServers.length === 0 ? (
                      <div className="text-center py-8 sm:py-12 px-3 sm:px-4 bg-[#40414f] rounded-lg border border-gray-700">
                        <Server className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-gray-600" />
                        <p className="text-xs sm:text-sm text-gray-400">
                          No MCP servers configured
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Add a server above to get started
                        </p>
                      </div>
                    ) : (
                      mcpServers.map((server) => (
                        <div
                          key={server.name}
                          className="flex items-center justify-between p-3 sm:p-4 bg-[#40414f] border border-gray-700 rounded-lg hover:border-gray-600 transition-colors"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-medium text-sm sm:text-base text-gray-200 mb-1 truncate">
                              {server.name}
                            </div>
                            <div className="text-xs sm:text-sm text-gray-400 truncate">
                              {server.url}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-gray-500">
                                Type: {server.connection_type || "http"}
                              </span>
                              {server.has_api_key && (
                                <span className="text-xs text-gray-500">
                                  🔒 API key configured
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-1.5 sm:gap-2 shrink-0">
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!server.name || !server.name.trim()) {
                                  toast.error("Server name is missing");
                                  return;
                                }
                                startEditServer(server);
                              }}
                              className="p-1.5 sm:p-2 hover:bg-[#343541] rounded-lg transition-colors touch-manipulation"
                              aria-label={`Edit ${server.name}`}
                              type="button"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 hover:text-[#10a37f]" />
                            </button>
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!server.name || !server.name.trim()) {
                                  toast.error("Server name is missing");
                                  return;
                                }
                                setDeletingServer(server.name);
                              }}
                              className="p-1.5 sm:p-2 hover:bg-red-500/20 rounded-lg transition-colors touch-manipulation"
                              aria-label={`Delete ${server.name}`}
                              type="button"
                            >
                              <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-400 hover:text-red-300" />
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* LLM Config tab disabled - commented out to avoid TypeScript errors */}
            {/* {activeTab === 'llm' && (
                            <div className="space-y-4 sm:space-y-5 md:space-y-6">
                                <div className="bg-[#40414f] rounded-lg p-4 sm:p-5 border border-gray-700">
                                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-gray-200">LLM Configuration</h3>
                                    <p className="text-gray-400">LLM configuration is disabled. The system uses a fixed OpenAI GPT (gpt-4o) configuration.</p>
                                </div>
                            </div>
                        )} */}

            {activeTab === "tools" && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">
                  Available Tools
                </h3>
                {toolsInfo ? (
                  <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    <div>
                      <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base text-gray-300 flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        Local Tools
                      </h4>
                      <div className="space-y-2">
                        {toolsInfo.local_tools.length === 0 ? (
                          <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm">
                            No local tools available
                          </div>
                        ) : (
                          toolsInfo.local_tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="p-3 sm:p-4 bg-[#40414f] border border-gray-700 rounded-lg"
                            >
                              <div className="font-medium text-sm sm:text-base text-gray-200 mb-1">
                                {tool.name}
                              </div>
                              <div className="text-xs sm:text-sm text-gray-400 mb-2">
                                {tool.description}
                              </div>
                              <div className="text-xs text-gray-500">
                                Type: {tool.type}
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    <div>
                      <h4 className="font-medium mb-2 sm:mb-3 text-sm sm:text-base text-gray-300 flex items-center gap-2">
                        <Server className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                        MCP Servers
                      </h4>
                      <div className="space-y-2">
                        {mcpServers.length === 0 ? (
                          <div className="text-center py-6 sm:py-8 text-gray-500 text-xs sm:text-sm">
                            No MCP servers configured
                          </div>
                        ) : (
                          mcpServers.map((server) => (
                            <div
                              key={server.name}
                              className="p-3 sm:p-4 bg-[#40414f] border border-gray-700 rounded-lg flex items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm sm:text-base text-gray-200 mb-1 truncate">
                                  {server.name}
                                </div>
                                <div className="text-xs sm:text-sm text-gray-400 mb-2 truncate">
                                  {server.url}
                                </div>
                                <div className="text-xs text-gray-500">
                                  Status:{" "}
                                  <span
                                    className={
                                      server.enabled !== false
                                        ? "text-green-400"
                                        : "text-red-400"
                                    }
                                  >
                                    {server.enabled !== false
                                      ? "Enabled"
                                      : "Disabled"}
                                  </span>
                                </div>
                              </div>
                              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                                <input
                                  type="checkbox"
                                  checked={server.enabled !== false}
                                  onChange={async (e) => {
                                    e.preventDefault();
                                    if (!server.name || !server.name.trim()) {
                                      toast.error("Server name is missing");
                                      return;
                                    }
                                    try {
                                      const result = await toggleMCPServer(
                                        server.name
                                      );
                                      // Backend returns {status, server, message}, TypeScript expects {server, message}
                                      const serverData = result.server;
                                      const newStatus = serverData?.enabled
                                        ? "enabled"
                                        : "disabled";
                                      toast.success(`MCP server ${newStatus}`);
                                      loadMCPServers();
                                    } catch (error) {
                                      toast.error(
                                        `Failed to toggle server: ${
                                          error instanceof Error
                                            ? error.message
                                            : "Unknown error"
                                        }`
                                      );
                                    }
                                  }}
                                  className="sr-only peer"
                                />
                                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#10a37f] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-[#10a37f] touch-manipulation"></div>
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-gray-500">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-2 text-[#10a37f]" />
                    <p className="text-xs sm:text-sm">
                      Loading tools information...
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Server Confirmation Modal */}
      {deletingServer && (
        <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[#343541] rounded-xl shadow-2xl max-w-md w-full border border-gray-700">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-200">
                  Delete MCP Server
                </h3>
              </div>
              <p className="text-sm sm:text-base text-gray-300 mb-4 sm:mb-6">
                Are you sure you want to delete{" "}
                <span className="font-medium text-white">{deletingServer}</span>
                ? This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={() => setDeletingServer(null)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-gray-300 hover:text-white hover:bg-[#40414f] rounded-lg transition-colors touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteServer(deletingServer)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-red-500 hover:bg-red-600 text-white rounded-lg transition-colors touch-manipulation"
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
