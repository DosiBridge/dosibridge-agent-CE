/**
 * Settings panel component for MCP servers and LLM config
 * ChatGPT-like dark theme design
 */

"use client";

import {
  CustomRAGTool,
  CustomRAGToolRequest,
  Document,
  DocumentCollection,
  LLMConfig,
  MCPServerRequest,
  ToolsInfo,
  addMCPServer,
  approveDocument,
  createCollection,
  createCustomRAGTool,
  deleteCollection,
  deleteCustomRAGTool,
  deleteDocument,
  deleteMCPServer,
  getDocumentsNeedingReview,
  getReviewStatistics,
  getToolsInfo,
  listCollections,
  listCustomRAGTools,
  listDocuments,
  rejectDocument,
  resetLLMConfig,
  setLLMConfig,
  testMCPServerConnection,
  toggleCustomRAGTool,
  toggleMCPServer,
  updateCustomRAGTool,
  updateMCPServer,
  uploadDocument,
} from "@/lib/api";
import { useStore } from "@/lib/store";
import {
  AlertTriangle,
  Brain,
  CheckCircle,
  Edit2,
  Eye,
  EyeOff,
  File,
  FileJson,
  Folder,
  Loader2,
  Lock,
  Plus,
  Save,
  Server,
  Settings,
  Trash2,
  Upload,
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
  initialTab?: "mcp" | "llm" | "tools" | "rag";
  selectedCollectionId?: number | null;
  onCollectionSelect?: (collectionId: number | null) => void;
  useReact?: boolean;
  onUseReactChange?: (useReact: boolean) => void;
}

export default function SettingsPanel({
  isOpen,
  onClose,
  initialTab = "mcp",
  selectedCollectionId: propSelectedCollectionId,
  onCollectionSelect: propOnCollectionSelect,
  useReact: propUseReact,
  onUseReactChange: propOnUseReactChange,
}: SettingsPanelProps) {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const mcpServers = useStore((state) => state.mcpServers);
  const llmConfig = useStore((state) => state.llmConfig);
  const loadMCPServers = useStore((state) => state.loadMCPServers);
  const loadLLMConfig = useStore((state) => state.loadLLMConfig);
  const selectedCollectionId = useStore((state) => state.selectedCollectionId);
  const setSelectedCollectionId = useStore(
    (state) => state.setSelectedCollectionId
  );
  const useReact = useStore((state) => state.useReact);
  const setUseReact = useStore((state) => state.setUseReact);

  const [toolsInfo, setToolsInfo] = useState<ToolsInfo | null>(null);
  const [activeTab, setActiveTab] = useState<"mcp" | "llm" | "tools" | "rag">(
    initialTab
  );
  const [editingServer, setEditingServer] = useState<string | null>(null);
  const [deletingServer, setDeletingServer] = useState<string | null>(null);
  const [customRAGTools, setCustomRAGTools] = useState<CustomRAGTool[]>([]);
  const [collections, setCollections] = useState<DocumentCollection[]>([]);
  const [editingTool, setEditingTool] = useState<number | null>(null);
  const [deletingTool, setDeletingTool] = useState<number | null>(null);
  const [toolForm, setToolForm] = useState<CustomRAGToolRequest>({
    name: "",
    description: "",
    collection_id: null,
    enabled: true,
  });
  const [showToolForm, setShowToolForm] = useState(false);

  // RAG Settings state
  const [ragActiveTab, setRagActiveTab] = useState<
    "documents" | "collections" | "review"
  >("documents");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [ragCollections, setRagCollections] = useState<DocumentCollection[]>(
    []
  );
  const [reviewDocuments, setReviewDocuments] = useState<Document[]>([]);
  const [stats, setStats] = useState({
    pending: 0,
    needs_review: 0,
    ready: 0,
    error: 0,
    total: 0,
  });
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [newCollectionName, setNewCollectionName] = useState("");
  const [newCollectionDesc, setNewCollectionDesc] = useState("");

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

  const loadCustomRAGTools = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const tools = await listCustomRAGTools();
      setCustomRAGTools(tools);
    } catch (error) {
      console.error("Failed to load custom RAG tools:", error);
    }
  }, [isAuthenticated]);

  const loadCollections = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const result = await listCollections();
      setCollections(result.collections);
      setRagCollections(result.collections);
    } catch (error) {
      console.error("Failed to load collections:", error);
    }
  }, [isAuthenticated]);

  // RAG Settings load functions
  const loadRAGDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const collectionId = propSelectedCollectionId ?? selectedCollectionId;
      const result = await listDocuments(collectionId || undefined);
      setDocuments(result.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  }, [isAuthenticated, propSelectedCollectionId, selectedCollectionId]);

  const loadReviewDocuments = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const result = await getDocumentsNeedingReview();
      setReviewDocuments(result.documents);
    } catch (err) {
      console.error("Failed to load review documents:", err);
    }
  }, [isAuthenticated]);

  const loadStats = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const stats = await getReviewStatistics();
      setStats(stats);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, [isAuthenticated]);

  // Compute currentCollectionId early
  const currentCollectionId = propSelectedCollectionId ?? selectedCollectionId;
  const currentUseReact = propUseReact ?? useReact;

  useEffect(() => {
    if (isOpen) {
      (async () => {
        try {
          await loadMCPServers();
          await loadLLMConfig();
          await loadToolsInfo();
          await loadCustomRAGTools();
          await loadCollections();
        } catch (error) {
          console.error("Failed to load settings:", error);
        }
      })();
    }
  }, [
    isOpen,
    loadMCPServers,
    loadLLMConfig,
    loadToolsInfo,
    loadCustomRAGTools,
    loadCollections,
  ]);

  // Load RAG data when RAG tab is active
  useEffect(() => {
    if (isOpen && activeTab === "rag" && isAuthenticated) {
      (async () => {
        try {
          await loadRAGDocuments();
          await loadReviewDocuments();
          await loadStats();
        } catch (error) {
          console.error("Failed to load RAG data:", error);
        }
      })();
    }
  }, [
    isOpen,
    activeTab,
    isAuthenticated,
    loadRAGDocuments,
    loadReviewDocuments,
    loadStats,
    currentCollectionId,
  ]);

  // Update activeTab when initialTab changes
  useEffect(() => {
    if (isOpen && initialTab) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);

  // RAG Settings handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files);
    await handleFiles(files);
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const files = Array.from(e.target.files);
      await handleFiles(files);
    }
  };

  const handleFiles = async (files: File[]) => {
    setIsUploading(true);
    try {
      const collectionId = propSelectedCollectionId ?? selectedCollectionId;
      for (const file of files) {
        await uploadDocument(file, collectionId || undefined);
      }
      toast.success(`Uploaded ${files.length} file(s)`);
      await loadRAGDocuments();
      await loadStats();
      await loadCollections();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteDocument = async (documentId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteDocument(documentId);
      toast.success("Document deleted");
      await loadRAGDocuments();
      await loadStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete document"
      );
    }
  };

  const handleApprove = async (documentId: number) => {
    try {
      await approveDocument(documentId);
      toast.success("Document approved");
      await loadRAGDocuments();
      await loadReviewDocuments();
      await loadStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to approve document"
      );
    }
  };

  const handleReject = async (documentId: number) => {
    const reason = prompt("Rejection reason (optional):");
    try {
      await rejectDocument(documentId, reason || undefined);
      toast.success("Document rejected");
      await loadRAGDocuments();
      await loadReviewDocuments();
      await loadStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to reject document"
      );
    }
  };

  const handleCreateCollection = async () => {
    if (!newCollectionName.trim()) {
      toast.error("Collection name is required");
      return;
    }
    try {
      await createCollection(newCollectionName, newCollectionDesc || undefined);
      toast.success("Collection created");
      setNewCollectionName("");
      setNewCollectionDesc("");
      await loadCollections();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to create collection"
      );
    }
  };

  const handleDeleteCollection = async (collectionId: number) => {
    if (!confirm("Are you sure you want to delete this collection?")) return;
    try {
      await deleteCollection(collectionId);
      toast.success("Collection deleted");
      const currentCollectionId =
        propSelectedCollectionId ?? selectedCollectionId;
      if (currentCollectionId === collectionId) {
        if (propOnCollectionSelect) {
          propOnCollectionSelect(null);
        } else {
          setSelectedCollectionId(null);
        }
      }
      await loadCollections();
      await loadRAGDocuments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete collection"
      );
    }
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case "needs_review":
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <File className="w-4 h-4 text-[var(--text-secondary)]" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const handleUseReactChange = (value: boolean) => {
    if (propOnUseReactChange) {
      propOnUseReactChange(value);
    } else {
      setUseReact(value);
    }
  };

  const handleCollectionSelect = (collectionId: number | null) => {
    if (propOnCollectionSelect) {
      propOnCollectionSelect(collectionId);
    } else {
      setSelectedCollectionId(collectionId);
    }
  };

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
          className="fixed inset-0 bg-[var(--modal-overlay)] z-50 flex items-center justify-center p-2 sm:p-3 md:p-4"
          onClick={onClose}
        >
          <div
            className="bg-[var(--modal-bg)] rounded-xl shadow-2xl w-full max-w-md flex flex-col border border-[var(--border)]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 sm:p-8 text-center">
              <div className="mb-6 flex justify-center">
                <div className="p-4 bg-[var(--surface-elevated)] rounded-full">
                  <Lock className="w-12 h-12 text-[var(--green)]" />
                </div>
              </div>
              <h2 className="text-2xl font-bold text-[var(--text-primary)] mb-3">
                Authentication Required
              </h2>
              <p className="text-[var(--text-secondary)] mb-6">
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
                  className="px-6 py-2.5 bg-[var(--green)] hover:bg-[var(--green-hover)] text-white font-medium rounded-lg transition-colors"
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
                  className="px-6 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] text-[var(--text-primary)] font-medium rounded-lg transition-colors border border-[var(--border)]"
                >
                  Create account
                </button>
              </div>
              <button
                onClick={onClose}
                className="mt-4 text-[var(--text-secondary)] hover:text-[var(--text-primary)] text-sm transition-colors"
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
        className="fixed inset-0 bg-[var(--modal-overlay)] z-50 flex items-center justify-center p-2 sm:p-3 md:p-4"
        onClick={onClose}
      >
        <div
          className="bg-[var(--modal-bg)] rounded-xl shadow-2xl w-full max-w-3xl max-h-[95vh] sm:max-h-[90vh] flex flex-col border border-[var(--border)]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-[var(--border)] shrink-0 bg-gradient-to-r from-[var(--surface)] to-[var(--surface-hover)]">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-[var(--green)]/10 rounded-lg">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 text-[var(--green)]" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-semibold text-[var(--text-primary)]">
                  Settings
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Configure MCP servers and model settings
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation group"
              aria-label="Close settings"
            >
              <X className="w-5 h-5 text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-[var(--border)] bg-[var(--surface-hover)] shrink-0 overflow-x-auto">
            <button
              onClick={() => setActiveTab("mcp")}
              className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation relative ${
                activeTab === "mcp"
                  ? "text-[var(--green)] bg-[var(--surface-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]/50"
              }`}
            >
              {activeTab === "mcp" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--green)] rounded-t-full" />
              )}
              <Server
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform ${
                  activeTab === "mcp" ? "scale-110" : ""
                }`}
              />
              <span className="truncate">MCP Servers</span>
            </button>
            {/* LLM Config tab disabled */}
            {/* <button
                            onClick={() => setActiveTab('llm')}
                            className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-colors flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation ${activeTab === 'llm'
                                ? 'border-b-2 border-[var(--green)] text-[var(--green)] bg-[var(--surface-elevated)]'
                                : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                                }`}
                        >
                            <Cpu className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
                            <span className="truncate">LLM Config</span>
                        </button> */}
            <button
              onClick={() => setActiveTab("tools")}
              className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation relative ${
                activeTab === "tools"
                  ? "text-[var(--green)] bg-[var(--surface-elevated)]"
                  : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]/50"
              }`}
            >
              {activeTab === "tools" && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--green)] rounded-t-full" />
              )}
              <Wrench
                className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform ${
                  activeTab === "tools" ? "scale-110" : ""
                }`}
              />
              <span className="truncate">Tools</span>
            </button>
            {isAuthenticated && (
              <button
                onClick={() => setActiveTab("rag")}
                className={`flex-1 min-w-0 px-3 sm:px-4 md:px-6 py-2.5 sm:py-3 font-medium text-xs sm:text-sm transition-all duration-200 flex items-center justify-center gap-1.5 sm:gap-2 touch-manipulation relative ${
                  activeTab === "rag"
                    ? "text-[var(--green)] bg-[var(--surface-elevated)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-elevated)]/50"
                }`}
              >
                {activeTab === "rag" && (
                  <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[var(--green)] rounded-t-full" />
                )}
                <File
                  className={`w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0 transition-transform ${
                    activeTab === "rag" ? "scale-110" : ""
                  }`}
                />
                <span className="truncate">RAG</span>
                {stats.needs_review > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                    {stats.needs_review}
                  </span>
                )}
              </button>
            )}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 md:p-6">
            {activeTab === "mcp" && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* Add/Edit Server Form */}
                <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl p-4 sm:p-5 md:p-6 border border-[var(--border)] shadow-lg">
                  <div className="flex items-center gap-3 mb-4 sm:mb-5">
                    <div
                      className={`p-2 rounded-lg ${
                        editingServer
                          ? "bg-blue-500/10"
                          : "bg-[var(--green)]/10"
                      }`}
                    >
                      {editingServer ? (
                        <Edit2 className="w-5 h-5 text-blue-400" />
                      ) : (
                        <Plus className="w-5 h-5 text-[var(--green)]" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                        {editingServer ? "Edit MCP Server" : "Add MCP Server"}
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {editingServer
                          ? "Update server configuration"
                          : "Connect a new MCP server"}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3 sm:space-y-4">
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-[var(--text-primary)]">
                        <span className="flex items-center gap-2">
                          <span>Name</span>
                          <span className="text-red-400">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={serverForm.name}
                        onChange={(e) =>
                          setServerForm({ ...serverForm, name: e.target.value })
                        }
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-[var(--input-border)] rounded-lg bg-[var(--surface-hover)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)] transition-all duration-200 hover:border-[var(--border-hover)]"
                        placeholder="e.g., My MCP Server"
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-[var(--text-primary)]">
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
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-[var(--input-border)] rounded-lg bg-[var(--surface-hover)] text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)] transition-all duration-200 hover:border-[var(--border-hover)] cursor-pointer"
                      >
                        <option value="http">HTTP</option>
                        <option value="sse">SSE (Server-Sent Events)</option>
                        <option value="stdio">STDIO (Command)</option>
                      </select>
                      <div className="mt-2 p-2.5 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)]">
                        <p className="text-xs text-[var(--text-secondary)] flex items-start gap-2">
                          <span className="text-[var(--green)] mt-0.5">ℹ️</span>
                          <span>
                            {serverForm.connection_type === "stdio"
                              ? "Enter the command to run (e.g., 'npx @modelcontextprotocol/server-filesystem /path')"
                              : serverForm.connection_type === "sse"
                              ? "URL will be automatically normalized to /sse endpoint"
                              : "URL will be automatically normalized to /mcp endpoint"}
                          </span>
                        </p>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-[var(--text-primary)]">
                        <span className="flex items-center gap-2">
                          <span>
                            {serverForm.connection_type === "stdio"
                              ? "Command"
                              : "URL"}
                          </span>
                          <span className="text-red-400">*</span>
                        </span>
                      </label>
                      <input
                        type="text"
                        value={serverForm.url}
                        onChange={(e) => {
                          setServerForm({ ...serverForm, url: e.target.value });
                          setConnectionStatus(null); // Clear status when URL changes
                        }}
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-[var(--input-border)] rounded-lg bg-[var(--surface-hover)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)] transition-all duration-200 hover:border-[var(--border-hover)] font-mono"
                        placeholder={
                          serverForm.connection_type === "stdio"
                            ? "npx @modelcontextprotocol/server-filesystem /path"
                            : serverForm.connection_type === "sse"
                            ? "http://localhost:8000/api/mcp/server/sse"
                            : "http://localhost:8000/api/mcp/server/mcp"
                        }
                      />
                    </div>
                    <div>
                      <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2 text-[var(--text-primary)]">
                        API Key{" "}
                        <span className="text-[var(--text-secondary)] font-normal">
                          (optional)
                        </span>
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
                        className="w-full px-3 sm:px-4 py-2.5 sm:py-3 text-sm sm:text-base border border-[var(--input-border)] rounded-lg bg-[var(--surface-hover)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)] transition-all duration-200 hover:border-[var(--border-hover)]"
                        placeholder="Enter API key if required"
                      />
                    </div>

                    {/* Authentication Section */}
                    <div className="border-t border-[var(--border)] pt-4 mt-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          <Lock className="w-4 h-4 text-[var(--text-secondary)]" />
                          <h4 className="text-sm font-semibold text-[var(--text-primary)]">
                            Custom Headers
                          </h4>
                        </div>
                      </div>

                      {/* Custom Headers */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <label className="text-xs sm:text-sm font-medium text-[var(--text-primary)]">
                            Headers
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
                                  ? "bg-[var(--green)] border-[var(--green)] text-white"
                                  : "bg-[var(--surface-elevated)] border-[var(--input-border)] text-[var(--text-primary)] hover:bg-[var(--surface-hover)]"
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
                              className="px-3 py-1.5 text-xs bg-[var(--surface-elevated)] border border-[var(--input-border)] text-[var(--text-primary)] rounded-lg hover:bg-[var(--surface-hover)] transition-colors flex items-center gap-1.5"
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
                              className="w-full px-3 py-2 text-sm border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)] font-mono focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)] min-h-[120px]"
                              placeholder='{\n  "Authorization": "Bearer token",\n  "X-Custom-Header": "value"\n}'
                            />
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {headerPairs.length === 0 ? (
                              <div className="text-center py-4 text-sm text-[var(--text-secondary)]">
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
                                      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:ring-offset-2 focus:ring-offset-[#343541] ${
                                        pair.enabled
                                          ? "bg-[var(--green)]"
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
                                      className="flex-1 px-3 py-2 text-sm border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)]"
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
                                      className="p-2 text-[var(--text-secondary)] hover:text-red-400 transition-colors"
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
                                      className="flex-1 px-3 py-2 text-sm border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)]"
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
                                      className="p-2 text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
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

                        <p className="text-xs text-[var(--text-secondary)] mt-3">
                          Use the toggle to enable/disable headers. Only enabled
                          headers with both name and value will be sent.
                        </p>
                      </div>
                    </div>

                    {/* Connection Status */}
                    {connectionStatus && (
                      <div
                        className={`p-4 rounded-lg border-2 flex items-start gap-3 animate-in fade-in slide-in-from-top-2 duration-300 ${
                          connectionStatus.connected
                            ? "bg-green-900/20 border-green-500/50 text-green-300"
                            : "bg-red-900/20 border-red-500/50 text-red-300"
                        }`}
                      >
                        <div
                          className={`p-1.5 rounded-full ${
                            connectionStatus.connected
                              ? "bg-green-500/20"
                              : "bg-red-500/20"
                          }`}
                        >
                          {connectionStatus.connected ? (
                            <CheckCircle className="w-5 h-5 shrink-0" />
                          ) : (
                            <WifiOff className="w-5 h-5 shrink-0" />
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-semibold mb-1">
                            {connectionStatus.connected
                              ? "Connection Successful"
                              : "Connection Failed"}
                          </p>
                          <p className="text-xs opacity-90 leading-relaxed">
                            {connectionStatus.message}
                          </p>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                      <button
                        onClick={handleTestConnection}
                        disabled={!serverForm.url.trim() || testingConnection}
                        className="px-4 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm sm:text-base touch-manipulation hover:scale-[1.02] active:scale-[0.98] border border-[var(--input-border)] hover:border-[var(--border-hover)]"
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
                        className="flex-1 px-4 py-2.5 bg-[var(--green)] hover:bg-[var(--green-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg transition-all duration-200 flex items-center justify-center gap-2 font-medium text-sm sm:text-base touch-manipulation hover:scale-[1.02] active:scale-[0.98] shadow-lg hover:shadow-xl shadow-[#10a37f]/20"
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
                          className="w-full sm:w-auto px-4 py-2.5 bg-[var(--surface-elevated)] hover:bg-[var(--surface-hover)] disabled:opacity-50 disabled:cursor-not-allowed text-[var(--text-primary)] rounded-lg transition-colors font-medium text-sm sm:text-base touch-manipulation"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Configured Servers List */}
                <div>
                  <div className="flex items-center gap-3 mb-4 sm:mb-5">
                    <div className="p-2 bg-[var(--green)]/10 rounded-lg">
                      <Server className="w-5 h-5 text-[var(--green)]" />
                    </div>
                    <div>
                      <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                        Configured Servers
                      </h3>
                      <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                        {mcpServers.length} server
                        {mcpServers.length !== 1 ? "s" : ""} configured
                      </p>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {mcpServers.length === 0 ? (
                      <div className="text-center py-12 sm:py-16 px-3 sm:px-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)]">
                        <div className="p-4 bg-[var(--surface-hover)] rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                          <Server className="w-8 h-8 text-[var(--text-secondary)]" />
                        </div>
                        <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-1">
                          No MCP servers configured
                        </p>
                        <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                          Add a server above to get started
                        </p>
                      </div>
                    ) : (
                      mcpServers.map((server) => (
                        <div
                          key={server.name}
                          className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--green)]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#10a37f]/10 group"
                        >
                          <div className="flex-1 min-w-0 pr-2">
                            <div className="font-medium text-sm sm:text-base text-[var(--text-primary)] mb-1 truncate">
                              {server.name}
                            </div>
                            <div className="text-xs sm:text-sm text-[var(--text-secondary)] truncate">
                              {server.url}
                            </div>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-xs text-[var(--text-secondary)]">
                                Type: {server.connection_type || "http"}
                              </span>
                              {server.has_api_key && (
                                <span className="text-xs text-[var(--text-secondary)]">
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
                              className="p-1.5 sm:p-2 hover:bg-[var(--surface-elevated)] rounded-lg transition-colors touch-manipulation"
                              aria-label={`Edit ${server.name}`}
                              type="button"
                            >
                              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[var(--text-secondary)] hover:text-[var(--green)]" />
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
                                <div className="bg-[var(--surface-elevated)] rounded-lg p-4 sm:p-5 border border-[var(--border)]">
                                    <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 text-[var(--text-primary)]">LLM Configuration</h3>
                                    <p className="text-[var(--text-secondary)]">LLM configuration is disabled. The system uses a fixed OpenAI GPT (gpt-4o) configuration.</p>
                                </div>
                            </div>
                        )} */}

            {activeTab === "tools" && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                <div className="flex items-center gap-3 mb-4 sm:mb-5">
                  <div className="p-2 bg-[var(--green)]/10 rounded-lg">
                    <Wrench className="w-5 h-5 text-[var(--green)]" />
                  </div>
                  <div>
                    <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                      Available Tools
                    </h3>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Manage and view available tools from MCP servers
                    </p>
                  </div>
                </div>
                {toolsInfo ? (
                  <div className="space-y-4 sm:space-y-5 md:space-y-6">
                    <div>
                      <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                        <Wrench className="w-4 h-4 shrink-0 text-[var(--green)]" />
                        <span>Local Tools</span>
                        <span className="text-xs text-[var(--text-secondary)] font-normal">
                          ({toolsInfo.local_tools.length})
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {toolsInfo.local_tools.length === 0 ? (
                          <div className="text-center py-8 sm:py-12 px-3 sm:px-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)]">
                            <div className="p-4 bg-[var(--surface-hover)] rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                              <Wrench className="w-8 h-8 text-[var(--text-secondary)]" />
                            </div>
                            <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-1">
                              No local tools available
                            </p>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                              Local tools will appear here when configured
                            </p>
                          </div>
                        ) : (
                          toolsInfo.local_tools.map((tool) => (
                            <div
                              key={tool.name}
                              className="p-4 sm:p-5 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--green)]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#10a37f]/10"
                            >
                              <div className="flex items-start gap-3">
                                <div className="p-2 bg-[var(--green)]/10 rounded-lg shrink-0">
                                  <Wrench className="w-4 h-4 text-[var(--green)]" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="font-semibold text-sm sm:text-base text-[var(--text-primary)] mb-1">
                                    {tool.name}
                                  </div>
                                  <div className="text-xs sm:text-sm text-[var(--text-secondary)] mb-2 leading-relaxed">
                                    {tool.description}
                                  </div>
                                  <div className="inline-flex items-center px-2 py-1 bg-[var(--surface-hover)] rounded-md text-xs text-[var(--text-secondary)] border border-[var(--border)]">
                                    Type: {tool.type}
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Custom RAG Tools Section */}
                    {isAuthenticated && (
                      <div>
                        <div className="flex items-center justify-between mb-3 sm:mb-4">
                          <div className="flex-1">
                            <h4 className="font-medium text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2 mb-1">
                              <FileJson className="w-4 h-4 shrink-0 text-[var(--green)]" />
                              <span>Custom RAG Tools</span>
                              <span className="text-xs text-[var(--text-secondary)] font-normal">
                                ({customRAGTools.length})
                              </span>
                            </h4>
                            <p className="text-xs text-[var(--text-secondary)] ml-6">
                              Supported file types: PDF, TXT, DOCX, DOC, MD (Max
                              100MB)
                            </p>
                          </div>
                          <button
                            onClick={() => {
                              setShowToolForm(true);
                              setEditingTool(null);
                              setToolForm({
                                name: "",
                                description: "",
                                collection_id: null,
                                enabled: true,
                              });
                            }}
                            className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 text-xs sm:text-sm font-medium text-white bg-[var(--green)] hover:bg-[var(--green-hover)] rounded-lg transition-colors touch-manipulation active:scale-95"
                          >
                            <Plus className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="hidden sm:inline">Add Tool</span>
                            <span className="sm:hidden">Add</span>
                          </button>
                        </div>
                        <div className="space-y-2">
                          {customRAGTools.length === 0 ? (
                            <div className="text-center py-8 sm:py-12 px-3 sm:px-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)]">
                              <div className="p-4 bg-[var(--surface-hover)] rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                                <FileJson className="w-8 h-8 text-[var(--text-secondary)]" />
                              </div>
                              <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-1">
                                No custom RAG tools
                              </p>
                              <p className="text-xs sm:text-sm text-[var(--text-secondary)] mb-2">
                                Create custom retrieval tools from your document
                                collections
                              </p>
                              <div className="text-xs text-[var(--text-secondary)] mb-4 px-4 py-2 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)]">
                                <p className="font-medium text-[var(--text-secondary)] mb-1">
                                  Supported File Types:
                                </p>
                                <ul className="list-disc list-inside space-y-0.5 text-[var(--text-secondary)]">
                                  <li>PDF (.pdf) — PDF files</li>
                                  <li>TXT (.txt) — Plain text files</li>
                                  <li>
                                    DOCX (.docx) — Microsoft Word documents
                                  </li>
                                  <li>DOC (.doc) — Older Word documents</li>
                                  <li>MD (.md) — Markdown files</li>
                                </ul>
                                <p className="mt-2 text-[var(--text-secondary)]">
                                  Maximum file size: 100MB per file
                                </p>
                              </div>
                              <button
                                onClick={() => {
                                  setShowToolForm(true);
                                  setEditingTool(null);
                                  setToolForm({
                                    name: "",
                                    description: "",
                                    collection_id: null,
                                    enabled: true,
                                  });
                                }}
                                className="px-4 py-2 text-sm font-medium text-white bg-[var(--green)] hover:bg-[var(--green-hover)] rounded-lg transition-colors"
                              >
                                Create Your First Tool
                              </button>
                            </div>
                          ) : (
                            customRAGTools.map((tool) => (
                              <div
                                key={tool.id}
                                className="p-4 sm:p-5 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--green)]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#10a37f]/10"
                              >
                                <div className="flex items-start gap-3">
                                  <div className="p-2 bg-[var(--green)]/10 rounded-lg shrink-0">
                                    <FileJson className="w-4 h-4 text-[var(--green)]" />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2 mb-2">
                                      <div className="flex-1">
                                        <div className="font-semibold text-sm sm:text-base text-[var(--text-primary)] mb-1">
                                          {tool.name}
                                        </div>
                                        <div className="text-xs sm:text-sm text-[var(--text-secondary)] mb-2 leading-relaxed">
                                          {tool.description}
                                        </div>
                                        {tool.collection_id && (
                                          <div className="text-xs text-[var(--text-secondary)] mb-2">
                                            Collection:{" "}
                                            {collections.find(
                                              (c) => c.id === tool.collection_id
                                            )?.name || "Unknown"}
                                          </div>
                                        )}
                                        <div className="flex items-center gap-2">
                                          <div className="inline-flex items-center px-2 py-1 bg-[var(--surface-hover)] rounded-md text-xs text-[var(--text-secondary)] border border-[var(--border)]">
                                            Type: RAG
                                          </div>
                                          <div
                                            className={`inline-flex items-center px-2 py-1 rounded-md text-xs border ${
                                              tool.enabled
                                                ? "bg-green-500/10 text-green-400 border-green-500/20"
                                                : "bg-red-500/10 text-red-400 border-red-500/20"
                                            }`}
                                          >
                                            {tool.enabled
                                              ? "Enabled"
                                              : "Disabled"}
                                          </div>
                                        </div>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <button
                                          onClick={async () => {
                                            try {
                                              await toggleCustomRAGTool(
                                                tool.id
                                              );
                                              toast.success(
                                                `Tool ${
                                                  tool.enabled
                                                    ? "disabled"
                                                    : "enabled"
                                                }`
                                              );
                                              await loadCustomRAGTools();
                                              await loadToolsInfo();
                                            } catch (error) {
                                              toast.error(
                                                `Failed to toggle tool: ${
                                                  error instanceof Error
                                                    ? error.message
                                                    : "Unknown error"
                                                }`
                                              );
                                            }
                                          }}
                                          className={`p-2 rounded-lg transition-colors ${
                                            tool.enabled
                                              ? "bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                              : "bg-gray-700 text-[var(--text-secondary)] hover:bg-gray-600"
                                          }`}
                                          title={
                                            tool.enabled ? "Disable" : "Enable"
                                          }
                                        >
                                          {tool.enabled ? (
                                            <CheckCircle className="w-4 h-4" />
                                          ) : (
                                            <X className="w-4 h-4" />
                                          )}
                                        </button>
                                        <button
                                          onClick={() => {
                                            setEditingTool(tool.id);
                                            setToolForm({
                                              name: tool.name,
                                              description: tool.description,
                                              collection_id: tool.collection_id,
                                              enabled: tool.enabled,
                                            });
                                            setShowToolForm(true);
                                          }}
                                          className="p-2 rounded-lg bg-gray-700 text-[var(--text-primary)] hover:bg-gray-600 transition-colors"
                                          title="Edit"
                                        >
                                          <Edit2 className="w-4 h-4" />
                                        </button>
                                        <button
                                          onClick={() =>
                                            setDeletingTool(tool.id)
                                          }
                                          className="p-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                          title="Delete"
                                        >
                                          <Trash2 className="w-4 h-4" />
                                        </button>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    <div>
                      <h4 className="font-medium mb-3 sm:mb-4 text-sm sm:text-base text-[var(--text-primary)] flex items-center gap-2">
                        <Server className="w-4 h-4 shrink-0 text-[var(--green)]" />
                        <span>MCP Servers</span>
                        <span className="text-xs text-[var(--text-secondary)] font-normal">
                          ({mcpServers.length})
                        </span>
                      </h4>
                      <div className="space-y-2">
                        {mcpServers.length === 0 ? (
                          <div className="text-center py-8 sm:py-12 px-3 sm:px-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-xl border-2 border-dashed border-[var(--border)]">
                            <div className="p-4 bg-[var(--surface-hover)] rounded-full w-16 h-16 mx-auto mb-4 flex items-center justify-center">
                              <Server className="w-8 h-8 text-[var(--text-secondary)]" />
                            </div>
                            <p className="text-sm sm:text-base font-medium text-[var(--text-primary)] mb-1">
                              No MCP servers configured
                            </p>
                            <p className="text-xs sm:text-sm text-[var(--text-secondary)]">
                              Configure MCP servers in the MCP Servers tab
                            </p>
                          </div>
                        ) : (
                          mcpServers.map((server) => (
                            <div
                              key={server.name}
                              className="p-4 sm:p-5 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] border border-[var(--border)] rounded-xl hover:border-[var(--green)]/50 transition-all duration-200 hover:shadow-lg hover:shadow-[#10a37f]/10 flex items-center justify-between gap-3"
                            >
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-sm sm:text-base text-[var(--text-primary)] mb-1 truncate">
                                  {server.name}
                                </div>
                                <div className="text-xs sm:text-sm text-[var(--text-secondary)] mb-2 truncate">
                                  {server.url}
                                </div>
                                <div className="text-xs text-[var(--text-secondary)]">
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
                                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--green)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-[var(--green)] touch-manipulation"></div>
                              </label>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 sm:py-12 text-[var(--text-secondary)]">
                    <Loader2 className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-2 text-[var(--green)]" />
                    <p className="text-xs sm:text-sm">
                      Loading tools information...
                    </p>
                  </div>
                )}
              </div>
            )}

            {activeTab === "rag" && isAuthenticated && (
              <div className="space-y-4 sm:space-y-5 md:space-y-6">
                {/* ReAct Mode Toggle */}
                <div className="p-4 border border-[var(--border)] rounded-xl bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)]">
                  <div className="flex items-center justify-between">
                    <div>
                      <label className="text-sm font-medium text-[var(--text-primary)] flex items-center gap-2">
                        <Brain className="w-4 h-4 text-[var(--green)]" />
                        ReAct Mode
                      </label>
                      <p className="text-xs text-[var(--text-secondary)] mt-1">
                        Enable reasoning and acting for better problem-solving
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={currentUseReact}
                        onChange={(e) => handleUseReactChange(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[var(--green)] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[var(--green)]"></div>
                    </label>
                  </div>
                </div>

                {/* RAG Sub-tabs */}
                <div className="flex border-b border-[var(--border)] bg-[var(--surface-hover)] rounded-t-lg overflow-x-auto">
                  <button
                    onClick={() => setRagActiveTab("documents")}
                    className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
                      ragActiveTab === "documents"
                        ? "border-b-2 border-[var(--green)] text-[var(--green)] bg-[var(--surface-elevated)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <File className="w-4 h-4" />
                    Documents
                  </button>
                  <button
                    onClick={() => setRagActiveTab("collections")}
                    className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
                      ragActiveTab === "collections"
                        ? "border-b-2 border-[var(--green)] text-[var(--green)] bg-[var(--surface-elevated)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Folder className="w-4 h-4" />
                    Collections
                  </button>
                  <button
                    onClick={() => setRagActiveTab("review")}
                    className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 relative ${
                      ragActiveTab === "review"
                        ? "border-b-2 border-[var(--green)] text-[var(--green)] bg-[var(--surface-elevated)]"
                        : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                    }`}
                  >
                    <Eye className="w-4 h-4" />
                    Review
                    {stats.needs_review > 0 && (
                      <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full">
                        {stats.needs_review}
                      </span>
                    )}
                  </button>
                </div>

                {/* Documents Tab */}
                {ragActiveTab === "documents" && (
                  <div className="space-y-4">
                    {/* Upload Area */}
                    <div
                      className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                        isDragging
                          ? "border-[var(--green)] bg-[var(--green)]/10"
                          : "border-[var(--input-border)] bg-[var(--surface-hover)]/50"
                      }`}
                      onDragOver={handleDragOver}
                      onDragLeave={handleDragLeave}
                      onDrop={handleDrop}
                    >
                      <Upload className="w-12 h-12 mx-auto mb-4 text-[var(--text-secondary)]" />
                      <p className="text-[var(--text-primary)] mb-2">
                        Drag and drop files here, or click to select
                      </p>
                      <p className="text-sm text-[var(--text-secondary)] mb-4">
                        Supported: PDF, TXT, DOCX, DOC, MD (Max 100MB)
                      </p>
                      <input
                        type="file"
                        multiple
                        accept=".pdf,.txt,.docx,.doc,.md"
                        onChange={handleFileSelect}
                        className="hidden"
                        id="file-upload"
                        disabled={isUploading}
                      />
                      <label
                        htmlFor="file-upload"
                        className={`inline-block px-4 py-2 rounded bg-[var(--green)] text-white cursor-pointer hover:bg-[var(--green-hover)] transition-colors ${
                          isUploading ? "opacity-50 cursor-not-allowed" : ""
                        }`}
                      >
                        {isUploading ? "Uploading..." : "Select Files"}
                      </label>
                    </div>

                    {/* Collection Filter */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[var(--text-primary)]">
                        Filter by Collection
                      </label>
                      <select
                        value={currentCollectionId || ""}
                        onChange={(e) =>
                          handleCollectionSelect(
                            e.target.value ? parseInt(e.target.value) : null
                          )
                        }
                        className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                      >
                        <option value="">All Documents</option>
                        {ragCollections.map((col) => (
                          <option key={col.id} value={col.id}>
                            {col.name} ({col.document_count})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Documents List */}
                    <div className="space-y-2">
                      {documents.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-secondary)]">
                          No documents found
                        </div>
                      ) : (
                        documents.map((doc) => (
                          <div
                            key={doc.id}
                            className="flex items-center justify-between p-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg border border-[var(--border)]"
                          >
                            <div className="flex items-center gap-3 flex-1">
                              {getStatusIcon(doc.status)}
                              <div className="flex-1">
                                <p className="text-[var(--text-primary)] font-medium">
                                  {doc.original_filename}
                                </p>
                                <p className="text-sm text-[var(--text-secondary)]">
                                  {formatFileSize(doc.file_size)} •{" "}
                                  {doc.chunk_count} chunks • {doc.status}
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {doc.status === "needs_review" && (
                                <>
                                  <button
                                    onClick={() => handleApprove(doc.id)}
                                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded text-white"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() => handleReject(doc.id)}
                                    className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded text-white"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              <button
                                onClick={() => handleDeleteDocument(doc.id)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Collections Tab */}
                {ragActiveTab === "collections" && (
                  <div className="space-y-4">
                    {/* Create Collection */}
                    <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                      <h3 className="text-lg font-semibold mb-4 text-[var(--text-primary)]">
                        Create Collection
                      </h3>
                      <div className="space-y-3">
                        <input
                          type="text"
                          value={newCollectionName}
                          onChange={(e) => setNewCollectionName(e.target.value)}
                          placeholder="Collection name"
                          className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                        />
                        <textarea
                          value={newCollectionDesc}
                          onChange={(e) => setNewCollectionDesc(e.target.value)}
                          placeholder="Description (optional)"
                          className="w-full px-3 py-2 border border-[var(--input-border)] rounded-lg bg-[var(--surface-elevated)] text-[var(--text-primary)]"
                          rows={2}
                        />
                        <button
                          onClick={handleCreateCollection}
                          className="px-4 py-2 bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg flex items-center gap-2"
                        >
                          <Plus className="w-4 h-4" />
                          Create Collection
                        </button>
                      </div>
                    </div>

                    {/* Collections List */}
                    <div className="space-y-2">
                      {ragCollections.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-secondary)]">
                          No collections found
                        </div>
                      ) : (
                        ragCollections.map((col) => (
                          <div
                            key={col.id}
                            className="flex items-center justify-between p-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg border border-[var(--border)]"
                          >
                            <div className="flex-1">
                              <p className="text-[var(--text-primary)] font-medium">
                                {col.name}
                              </p>
                              {col.description && (
                                <p className="text-sm text-[var(--text-secondary)] mt-1">
                                  {col.description}
                                </p>
                              )}
                              <p className="text-xs text-[var(--text-secondary)] mt-1">
                                {col.document_count} documents
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => handleCollectionSelect(col.id)}
                                className={`px-3 py-1 text-sm rounded ${
                                  currentCollectionId === col.id
                                    ? "bg-[var(--green)] text-white"
                                    : "bg-gray-700 text-[var(--text-primary)] hover:bg-gray-600"
                                }`}
                              >
                                {currentCollectionId === col.id
                                  ? "Selected"
                                  : "Select"}
                              </button>
                              <button
                                onClick={() => handleDeleteCollection(col.id)}
                                className="p-2 text-red-400 hover:text-red-300 hover:bg-red-500/20 rounded"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Review Tab */}
                {ragActiveTab === "review" && (
                  <div className="space-y-4">
                    {/* Statistics */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Pending
                        </p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {stats.pending}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Needs Review
                        </p>
                        <p className="text-2xl font-bold text-yellow-400">
                          {stats.needs_review}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Ready
                        </p>
                        <p className="text-2xl font-bold text-green-400">
                          {stats.ready}
                        </p>
                      </div>
                      <div className="bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg p-4 border border-[var(--border)]">
                        <p className="text-sm text-[var(--text-secondary)]">
                          Total
                        </p>
                        <p className="text-2xl font-bold text-[var(--text-primary)]">
                          {stats.total}
                        </p>
                      </div>
                    </div>

                    {/* Review Documents */}
                    <div className="space-y-2">
                      {reviewDocuments.length === 0 ? (
                        <div className="text-center py-8 text-[var(--text-secondary)]">
                          No documents need review
                        </div>
                      ) : (
                        reviewDocuments.map((doc) => (
                          <div
                            key={doc.id}
                            className="p-4 bg-gradient-to-br from-[var(--surface-elevated)] to-[var(--surface)] rounded-lg border border-[var(--border)]"
                          >
                            <div className="flex items-start justify-between mb-3">
                              <div className="flex-1">
                                <p className="text-[var(--text-primary)] font-medium">
                                  {doc.original_filename}
                                </p>
                                <p className="text-sm text-[var(--text-secondary)] mt-1">
                                  {formatFileSize(doc.file_size)} •{" "}
                                  {doc.chunk_count} chunks
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                <button
                                  onClick={() => handleApprove(doc.id)}
                                  className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded text-white"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(doc.id)}
                                  className="px-3 py-1 text-sm bg-red-600 hover:bg-red-700 rounded text-white"
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Delete Server Confirmation Modal */}
      {deletingServer && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--surface-elevated)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)]">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                  Delete MCP Server
                </h3>
              </div>
              <p className="text-sm sm:text-base text-[var(--text-primary)] mb-4 sm:mb-6">
                Are you sure you want to delete{" "}
                <span className="font-medium text-white">{deletingServer}</span>
                ? This action cannot be undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={() => setDeletingServer(null)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-colors touch-manipulation"
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

      {/* Custom RAG Tool Form Modal */}
      {showToolForm && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--surface-elevated)] rounded-xl shadow-2xl max-w-2xl w-full border border-[var(--border)] max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-4 sm:mb-6">
                <div className="flex items-center gap-2 sm:gap-3">
                  <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-[var(--green)]/20 flex items-center justify-center shrink-0">
                    <FileJson className="w-4 h-4 sm:w-5 sm:h-5 text-[var(--green)]" />
                  </div>
                  <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                    {editingTool
                      ? "Edit Custom RAG Tool"
                      : "Create Custom RAG Tool"}
                  </h3>
                </div>
                <button
                  onClick={() => {
                    setShowToolForm(false);
                    setEditingTool(null);
                    setToolForm({
                      name: "",
                      description: "",
                      collection_id: null,
                      enabled: true,
                    });
                  }}
                  className="p-2 hover:bg-[var(--surface-hover)] rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-[var(--text-secondary)]" />
                </button>
              </div>

              <div className="space-y-4 sm:space-y-5">
                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    <span>Tool Name</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <input
                    type="text"
                    value={toolForm.name}
                    onChange={(e) =>
                      setToolForm({ ...toolForm, name: e.target.value })
                    }
                    placeholder="e.g., retrieve_my_docs"
                    className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    Unique name for the tool (lowercase, underscores allowed)
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    <span>Description</span>
                    <span className="text-red-400 ml-1">*</span>
                  </label>
                  <textarea
                    value={toolForm.description}
                    onChange={(e) =>
                      setToolForm({ ...toolForm, description: e.target.value })
                    }
                    placeholder="Describe what this tool retrieves..."
                    rows={3}
                    className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent resize-none"
                  />
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    This description helps the AI understand when to use this
                    tool
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                    Collection (Optional)
                  </label>
                  <select
                    value={toolForm.collection_id || ""}
                    onChange={(e) =>
                      setToolForm({
                        ...toolForm,
                        collection_id: e.target.value
                          ? parseInt(e.target.value)
                          : null,
                      })
                    }
                    className="w-full px-4 py-2.5 bg-[var(--surface-elevated)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent"
                  >
                    <option value="">All Collections</option>
                    {collections.map((collection) => (
                      <option key={collection.id} value={collection.id}>
                        {collection.name}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1.5 text-xs text-[var(--text-secondary)]">
                    Select a specific collection or leave blank to search all
                    documents
                  </p>
                </div>

                <div className="p-3 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)]">
                  <p className="text-xs font-medium text-[var(--text-secondary)] mb-2">
                    📄 Supported Document Types:
                  </p>
                  <ul className="text-xs text-[var(--text-secondary)] space-y-1 list-disc list-inside">
                    <li>PDF (.pdf) — PDF files</li>
                    <li>TXT (.txt) — Plain text files</li>
                    <li>DOCX (.docx) — Microsoft Word documents</li>
                    <li>DOC (.doc) — Older Word documents</li>
                    <li>MD (.md) — Markdown files</li>
                  </ul>
                  <p className="text-xs text-[var(--text-secondary)] mt-2">
                    💡 Upload documents in RAG Settings tab first, then create
                    tools to retrieve from them.
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="tool-enabled"
                    checked={toolForm.enabled}
                    onChange={(e) =>
                      setToolForm({ ...toolForm, enabled: e.target.checked })
                    }
                    className="w-4 h-4 text-[var(--green)] bg-[var(--surface-elevated)] border-[var(--input-border)] rounded focus:ring-[var(--green)] focus:ring-2"
                  />
                  <label
                    htmlFor="tool-enabled"
                    className="text-sm text-[var(--text-primary)] cursor-pointer"
                  >
                    Enable this tool
                  </label>
                </div>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end mt-6 sm:mt-8">
                <button
                  onClick={() => {
                    setShowToolForm(false);
                    setEditingTool(null);
                    setToolForm({
                      name: "",
                      description: "",
                      collection_id: null,
                      enabled: true,
                    });
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-colors touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    if (!toolForm.name.trim() || !toolForm.description.trim()) {
                      toast.error("Name and description are required");
                      return;
                    }
                    try {
                      if (editingTool) {
                        await updateCustomRAGTool(editingTool, toolForm);
                        toast.success("Tool updated successfully");
                      } else {
                        await createCustomRAGTool(toolForm);
                        toast.success("Tool created successfully");
                      }
                      setShowToolForm(false);
                      setEditingTool(null);
                      setToolForm({
                        name: "",
                        description: "",
                        collection_id: null,
                        enabled: true,
                      });
                      await loadCustomRAGTools();
                      await loadToolsInfo();
                    } catch (error) {
                      toast.error(
                        `Failed to ${editingTool ? "update" : "create"} tool: ${
                          error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`
                      );
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium bg-[var(--green)] hover:bg-[var(--green-hover)] text-white rounded-lg transition-colors touch-manipulation"
                >
                  {editingTool ? "Update Tool" : "Create Tool"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Custom RAG Tool Confirmation Modal */}
      {deletingTool && (
        <div className="fixed inset-0 bg-black/70 z-[100] flex items-center justify-center p-3 sm:p-4">
          <div className="bg-[var(--surface-elevated)] rounded-xl shadow-2xl max-w-md w-full border border-[var(--border)]">
            <div className="p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-red-500/20 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-red-400" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-[var(--text-primary)]">
                  Delete Custom RAG Tool
                </h3>
              </div>
              <p className="text-sm sm:text-base text-[var(--text-primary)] mb-4 sm:mb-6">
                Are you sure you want to delete this tool? This action cannot be
                undone.
              </p>
              <div className="flex flex-col-reverse sm:flex-row gap-2 sm:gap-3 justify-end">
                <button
                  onClick={() => setDeletingTool(null)}
                  className="w-full sm:w-auto px-4 py-2.5 sm:py-2 text-sm font-medium text-[var(--text-primary)] hover:text-white hover:bg-[var(--surface-hover)] rounded-lg transition-colors touch-manipulation"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    try {
                      await deleteCustomRAGTool(deletingTool);
                      toast.success("Tool deleted successfully");
                      setDeletingTool(null);
                      await loadCustomRAGTools();
                      await loadToolsInfo();
                    } catch (error) {
                      toast.error(
                        `Failed to delete tool: ${
                          error instanceof Error
                            ? error.message
                            : "Unknown error"
                        }`
                      );
                    }
                  }}
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
