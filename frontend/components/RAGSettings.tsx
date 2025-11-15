/**
 * RAG Settings Panel - Document management and RAG configuration
 */
"use client";

import {
  Document,
  DocumentCollection,
  addTextToRAG,
  approveDocument,
  createCollection,
  deleteCollection,
  deleteDocument,
  getDocumentsNeedingReview,
  getReviewStatistics,
  listCollections,
  listDocuments,
  rejectDocument,
  uploadDocument,
} from "@/lib/api";
import {
  AlertCircle,
  Brain,
  CheckCircle,
  Eye,
  File,
  Folder,
  Loader2,
  Plus,
  Settings as SettingsIcon,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";

interface RAGSettingsProps {
  isOpen: boolean;
  onClose: () => void;
  selectedCollectionId?: number | null;
  onCollectionSelect?: (collectionId: number | null) => void;
  useReact: boolean;
  onUseReactChange?: (useReact: boolean) => void;
}

export default function RAGSettings({
  isOpen,
  onClose,
  selectedCollectionId,
  onCollectionSelect,
  useReact,
  onUseReactChange,
}: RAGSettingsProps) {
  const [activeTab, setActiveTab] = useState<
    "documents" | "collections" | "review"
  >("documents");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [collections, setCollections] = useState<DocumentCollection[]>([]);
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
  const [showAddText, setShowAddText] = useState(false);
  const [textTitle, setTextTitle] = useState("");
  const [textContent, setTextContent] = useState("");
  const [isAddingText, setIsAddingText] = useState(false);

  const loadDocuments = useCallback(async () => {
    try {
      const result = await listDocuments(selectedCollectionId || undefined);
      setDocuments(result.documents);
    } catch (err) {
      console.error("Failed to load documents:", err);
    }
  }, [selectedCollectionId]);

  const loadCollections = useCallback(async () => {
    try {
      const result = await listCollections();
      setCollections(result.collections);
    } catch (err) {
      console.error("Failed to load collections:", err);
    }
  }, []);

  const loadReviewDocuments = useCallback(async () => {
    try {
      const result = await getDocumentsNeedingReview();
      setReviewDocuments(result.documents);
    } catch (err) {
      console.error("Failed to load review documents:", err);
    }
  }, []);

  const loadStats = useCallback(async () => {
    try {
      const stats = await getReviewStatistics();
      setStats(stats);
    } catch (err) {
      console.error("Failed to load stats:", err);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadDocuments();
      loadCollections();
      loadReviewDocuments();
      loadStats();
    }
  }, [isOpen, loadDocuments, loadCollections, loadReviewDocuments, loadStats]);

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
      for (const file of files) {
        await uploadDocument(file, selectedCollectionId || undefined);
      }
      toast.success(`Uploaded ${files.length} file(s)`);
      await loadDocuments();
      await loadStats();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to upload document"
      );
    } finally {
      setIsUploading(false);
    }
  };

  const handleDelete = async (documentId: number) => {
    if (!confirm("Are you sure you want to delete this document?")) return;
    try {
      await deleteDocument(documentId);
      toast.success("Document deleted");
      await loadDocuments();
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
      await loadDocuments();
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
      await loadDocuments();
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
      if (selectedCollectionId === collectionId && onCollectionSelect) {
        onCollectionSelect(null);
      }
      await loadCollections();
      await loadDocuments();
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Failed to delete collection"
      );
    }
  };

  const handleAddText = async () => {
    if (!textTitle.trim() || !textContent.trim()) {
      toast.error("Title and content are required");
      return;
    }
    setIsAddingText(true);
    try {
      const result = await addTextToRAG({
        title: textTitle,
        content: textContent,
        collection_id: selectedCollectionId || undefined,
      });
      toast.success(`Added text: ${result.chunks_added} chunks created`);
      setTextTitle("");
      setTextContent("");
      setShowAddText(false);
      await loadDocuments();
      await loadStats();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add text");
    } finally {
      setIsAddingText(false);
    }
  };

  const getStatusIcon = (status: Document["status"]) => {
    switch (status) {
      case "ready":
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />;
      case "error":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "needs_review":
        return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default:
        return <File className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-2 sm:p-3 md:p-4">
      <div
        className="bg-[#343541] rounded-xl shadow-2xl w-full max-w-4xl max-h-[95vh] flex flex-col border border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 md:p-6 border-b border-gray-700 shrink-0">
          <h2 className="text-lg sm:text-xl font-semibold text-gray-200 flex items-center gap-2">
            <SettingsIcon className="w-5 h-5" />
            RAG Settings
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-[#40414f] rounded-lg transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700 bg-[#2d2d2f] shrink-0 overflow-x-auto">
          <button
            onClick={() => setActiveTab("documents")}
            className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "documents"
                ? "border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <File className="w-4 h-4" />
            Documents
          </button>
          <button
            onClick={() => setActiveTab("collections")}
            className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 ${
              activeTab === "collections"
                ? "border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]"
                : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Folder className="w-4 h-4" />
            Collections
          </button>
          <button
            onClick={() => setActiveTab("review")}
            className={`px-4 py-3 font-medium text-sm transition-colors flex items-center gap-2 relative ${
              activeTab === "review"
                ? "border-b-2 border-[#10a37f] text-[#10a37f] bg-[#343541]"
                : "text-gray-400 hover:text-gray-200"
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

        {/* RAG Mode Settings */}
        <div className="p-4 border-b border-gray-700 bg-[#2d2d2f] shrink-0">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium text-gray-200 flex items-center gap-2">
                <Brain className="w-4 h-4" />
                ReAct Mode
              </label>
              <p className="text-xs text-gray-400 mt-1">
                Enable reasoning and acting for better problem-solving
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={useReact}
                onChange={(e) => onUseReactChange?.(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-600 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-[#10a37f] rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#10a37f]"></div>
            </label>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6">
          {activeTab === "documents" && (
            <div className="space-y-4">
              {/* Upload Area */}
              <div
                className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
                  isDragging
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-gray-600 bg-gray-800/50"
                }`}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <Upload className="w-12 h-12 mx-auto mb-4 text-gray-400" />
                <p className="text-gray-300 mb-2">
                  Drag and drop files here, or click to select
                </p>
                <p className="text-sm text-gray-500 mb-4">
                  Supported: PDF, TXT, DOCX, MD (Max 100MB)
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
                  className={`inline-block px-4 py-2 rounded bg-blue-600 text-white cursor-pointer hover:bg-blue-700 transition-colors ${
                    isUploading ? "opacity-50 cursor-not-allowed" : ""
                  }`}
                >
                  {isUploading ? "Uploading..." : "Select Files"}
                </label>
              </div>

              {/* Add Text Directly */}
              <div className="border border-gray-600 rounded-lg p-4 bg-gray-800/50">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-medium text-gray-300">
                    Or Add Text Directly
                  </h3>
                  <button
                    onClick={() => setShowAddText(!showAddText)}
                    className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 rounded text-white flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    {showAddText ? "Hide" : "Add Text"}
                  </button>
                </div>
                {showAddText && (
                  <div className="space-y-3 mt-3">
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-300">
                        Title
                      </label>
                      <input
                        type="text"
                        value={textTitle}
                        onChange={(e) => setTextTitle(e.target.value)}
                        placeholder="Enter document title"
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-[#40414f] text-gray-100 placeholder-gray-500"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium mb-1 text-gray-300">
                        Content
                      </label>
                      <textarea
                        value={textContent}
                        onChange={(e) => setTextContent(e.target.value)}
                        placeholder="Enter your text content here..."
                        rows={6}
                        className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-[#40414f] text-gray-100 placeholder-gray-500 resize-y"
                      />
                    </div>
                    <button
                      onClick={handleAddText}
                      disabled={
                        isAddingText || !textTitle.trim() || !textContent.trim()
                      }
                      className={`w-full px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 transition-colors ${
                        isAddingText || !textTitle.trim() || !textContent.trim()
                          ? "opacity-50 cursor-not-allowed"
                          : ""
                      }`}
                    >
                      {isAddingText ? "Adding..." : "Add to RAG"}
                    </button>
                  </div>
                )}
              </div>

              {/* Collection Filter */}
              <div>
                <label className="block text-sm font-medium mb-2 text-gray-300">
                  Filter by Collection
                </label>
                <select
                  value={selectedCollectionId || ""}
                  onChange={(e) =>
                    onCollectionSelect?.(
                      e.target.value ? parseInt(e.target.value) : null
                    )
                  }
                  className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-[#40414f] text-gray-100"
                >
                  <option value="">All Documents</option>
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>
                      {col.name} ({col.document_count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Documents List */}
              <div className="space-y-2">
                {documents.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No documents found
                  </div>
                ) : (
                  documents.map((doc) => (
                    <div
                      key={doc.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-center gap-3 flex-1">
                        {getStatusIcon(doc.status)}
                        <div className="flex-1">
                          <p className="text-gray-200 font-medium">
                            {doc.original_filename}
                          </p>
                          <p className="text-sm text-gray-400">
                            {formatFileSize(doc.file_size)} • {doc.chunk_count}{" "}
                            chunks • {doc.status}
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
                          onClick={() => handleDelete(doc.id)}
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

          {activeTab === "collections" && (
            <div className="space-y-4">
              {/* Create Collection */}
              <div className="bg-[#40414f] rounded-lg p-4 border border-gray-700">
                <h3 className="text-lg font-semibold mb-4 text-gray-200">
                  Create Collection
                </h3>
                <div className="space-y-3">
                  <input
                    type="text"
                    value={newCollectionName}
                    onChange={(e) => setNewCollectionName(e.target.value)}
                    placeholder="Collection name"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-[#343541] text-gray-100"
                  />
                  <textarea
                    value={newCollectionDesc}
                    onChange={(e) => setNewCollectionDesc(e.target.value)}
                    placeholder="Description (optional)"
                    className="w-full px-3 py-2 border border-gray-600 rounded-lg bg-[#343541] text-gray-100"
                    rows={2}
                  />
                  <button
                    onClick={handleCreateCollection}
                    className="px-4 py-2 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg flex items-center gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create Collection
                  </button>
                </div>
              </div>

              {/* Collections List */}
              <div className="space-y-2">
                {collections.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No collections found
                  </div>
                ) : (
                  collections.map((col) => (
                    <div
                      key={col.id}
                      className="flex items-center justify-between p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex-1">
                        <p className="text-gray-200 font-medium">{col.name}</p>
                        {col.description && (
                          <p className="text-sm text-gray-400 mt-1">
                            {col.description}
                          </p>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                          {col.document_count} documents
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onCollectionSelect?.(col.id)}
                          className={`px-3 py-1 text-sm rounded ${
                            selectedCollectionId === col.id
                              ? "bg-[#10a37f] text-white"
                              : "bg-gray-700 text-gray-300 hover:bg-gray-600"
                          }`}
                        >
                          {selectedCollectionId === col.id
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

          {activeTab === "review" && (
            <div className="space-y-4">
              {/* Statistics */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-[#40414f] rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Pending</p>
                  <p className="text-2xl font-bold text-gray-200">
                    {stats.pending}
                  </p>
                </div>
                <div className="bg-[#40414f] rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Needs Review</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {stats.needs_review}
                  </p>
                </div>
                <div className="bg-[#40414f] rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Ready</p>
                  <p className="text-2xl font-bold text-green-400">
                    {stats.ready}
                  </p>
                </div>
                <div className="bg-[#40414f] rounded-lg p-4 border border-gray-700">
                  <p className="text-sm text-gray-400">Total</p>
                  <p className="text-2xl font-bold text-gray-200">
                    {stats.total}
                  </p>
                </div>
              </div>

              {/* Review Documents */}
              <div className="space-y-2">
                {reviewDocuments.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    No documents need review
                  </div>
                ) : (
                  reviewDocuments.map((doc) => (
                    <div
                      key={doc.id}
                      className="p-4 bg-gray-800 rounded-lg border border-gray-700"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <p className="text-gray-200 font-medium">
                            {doc.original_filename}
                          </p>
                          <p className="text-sm text-gray-400 mt-1">
                            {formatFileSize(doc.file_size)} • {doc.chunk_count}{" "}
                            chunks
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
      </div>
    </div>
  );
}
