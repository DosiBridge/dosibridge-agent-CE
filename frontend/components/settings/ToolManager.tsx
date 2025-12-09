import React, { useState, useEffect } from "react";
import { Plus, Trash2, Wrench, Loader2, Power, Search } from "lucide-react";
import { CustomRAGTool, DocumentCollection } from "@/types/api";
import {
    createCustomRAGTool,
    listCustomRAGTools,
    deleteCustomRAGTool,
    toggleCustomRAGTool,
    updateCustomRAGTool
} from "@/lib/api/tools";
import { listCollections } from "@/lib/api/documents";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

export default function ToolManager() {
    const [tools, setTools] = useState<CustomRAGTool[]>([]);
    const [collections, setCollections] = useState<DocumentCollection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        name: "",
        description: "",
        collection_id: "" as string | number, // empty string for "All Docs", number for specific collection
        enabled: true
    });

    const loadData = async () => {
        setIsLoading(true);
        try {
            const [toolsRes, colsRes] = await Promise.all([
                listCustomRAGTools(),
                listCollections()
            ]);
            setTools(toolsRes);
            setCollections(colsRes.collections);
        } catch (error) {
            console.error("Failed to load tools data:", error);
            toast.error("Failed to load tools");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadData();
    }, []);

    const resetForm = () => {
        setFormData({
            name: "",
            description: "",
            collection_id: "",
            enabled: true
        });
        setEditingId(null);
        setShowForm(false);
    };

    const handleEdit = (tool: CustomRAGTool) => {
        setFormData({
            name: tool.name,
            description: tool.description,
            collection_id: tool.collection_id || "",
            enabled: tool.enabled
        });
        setEditingId(tool.id);
        setShowForm(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.name.trim() || !formData.description.trim()) return;

        setIsSubmitting(true);
        try {
            const payload = {
                name: formData.name,
                description: formData.description,
                collection_id: formData.collection_id ? Number(formData.collection_id) : null,
                enabled: formData.enabled
            };

            if (editingId) {
                await updateCustomRAGTool(editingId, payload);
                toast.success("Tool updated successfully");
            } else {
                await createCustomRAGTool(payload);
                toast.success("Tool created successfully");
            }

            resetForm();
            loadData();
        } catch (error) {
            // @ts-ignore
            toast.error(error.message || "Failed to save tool");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure you want to delete this tool?")) return;

        try {
            await deleteCustomRAGTool(id);
            toast.success("Tool deleted");
            loadData();
        } catch (error) {
            toast.error("Failed to delete tool");
        }
    };

    const handleToggle = async (id: number) => {
        try {
            await toggleCustomRAGTool(id);
            // Optimistic update
            setTools(tools.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
            toast.success("Tool status updated");
        } catch (error) {
            toast.error("Failed to toggle tool");
            loadData(); // Revert on error
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Custom RAG Tools</h3>
                    <p className="text-sm text-zinc-400">Create specialized AI tools that search specific document collections.</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        Create Tool
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">{editingId ? 'Edit Tool' : 'Create New Tool'}</h4>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Tool Name</label>
                                <input
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                    placeholder="e.g. Finance Search"
                                    autoFocus
                                />
                                <p className="text-[10px] text-zinc-500 mt-1">Unique name for the AI to identify this tool.</p>
                            </div>
                            <div>
                                <label className="block text-xs text-zinc-400 mb-1">Target Collection</label>
                                <select
                                    value={formData.collection_id}
                                    onChange={(e) => setFormData({ ...formData, collection_id: e.target.value })}
                                    className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="">All Documents (Global Search)</option>
                                    {collections.map(col => (
                                        <option key={col.id} value={col.id}>{col.name}</option>
                                    ))}
                                </select>
                                <p className="text-[10px] text-zinc-500 mt-1">Limit this tool to search only within a specific collection.</p>
                            </div>
                        </div>

                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Description</label>
                            <textarea
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none min-h-[80px]"
                                placeholder="e.g. Searches through Q1 financial reports and invoices to answer finance questions."
                            />
                            <p className="text-[10px] text-zinc-500 mt-1">
                                Crucial for the AI agent! Explain <strong>what</strong> this tool does and <strong>when</strong> the AI should use it.
                            </p>
                        </div>

                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isSubmitting || !formData.name.trim() || !formData.description.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                {isSubmitting && <Loader2 className="w-3 h-3 animate-spin" />}
                                {editingId ? 'Update Tool' : 'Create Tool'}
                            </button>
                            <button
                                type="button"
                                onClick={resetForm}
                                className="text-zinc-400 hover:text-white px-4 py-2 text-sm"
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center p-8 bg-zinc-900/30 rounded-xl border border-zinc-800">
                    <Loader2 className="w-6 h-6 animate-spin text-zinc-500" />
                </div>
            ) : tools.length > 0 ? (
                <div className="space-y-3">
                    {tools.map((tool) => (
                        <div
                            key={tool.id}
                            className={cn(
                                "bg-zinc-900/30 border rounded-xl p-4 flex items-center justify-between group transition-all",
                                tool.enabled ? "border-zinc-800 hover:border-zinc-700" : "border-zinc-800/50 opacity-60 hover:opacity-100"
                            )}
                        >
                            <div className="flex items-center gap-4">
                                <div className={cn(
                                    "w-10 h-10 rounded-lg flex items-center justify-center shrink-0",
                                    tool.enabled ? "bg-amber-500/10 text-amber-500" : "bg-zinc-800 text-zinc-500"
                                )}>
                                    <Wrench className="w-5 h-5" />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <h4 className={cn("font-medium", tool.enabled ? "text-white" : "text-zinc-400")}>{tool.name}</h4>
                                        {!tool.enabled && (
                                            <span className="text-[10px] uppercase bg-zinc-800 text-zinc-500 px-1.5 py-0.5 rounded">Disabled</span>
                                        )}
                                        {tool.collection_id ? (
                                            <span className="text-[10px] bg-indigo-500/10 text-indigo-400 px-1.5 py-0.5 rounded flex items-center gap-1">
                                                <Search className="w-3 h-3" />
                                                {collections.find(c => c.id === tool.collection_id)?.name || "Unknown Collection"}
                                            </span>
                                        ) : (
                                            <span className="text-[10px] bg-zinc-800 text-zinc-400 px-1.5 py-0.5 rounded">
                                                Global Search
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-sm text-zinc-500 mt-1 max-w-xl">{tool.description}</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => handleToggle(tool.id)}
                                    className={cn(
                                        "p-2 rounded-lg transition-colors",
                                        tool.enabled
                                            ? "text-green-400 hover:bg-green-500/10"
                                            : "text-zinc-500 hover:text-green-400 hover:bg-zinc-800"
                                    )}
                                    title={tool.enabled ? "Disable tool" : "Enable tool"}
                                >
                                    <Power className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleEdit(tool)}
                                    className="p-2 text-zinc-500 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Edit tool"
                                >
                                    <Wrench className="w-4 h-4" />
                                </button>
                                <button
                                    onClick={() => handleDelete(tool.id)}
                                    className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors"
                                    title="Delete tool"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    <Wrench className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No custom tools created yet.</p>
                    <button onClick={() => setShowForm(true)} className="text-indigo-400 hover:text-indigo-300 text-sm mt-2">
                        Create your first custom tool
                    </button>
                </div>
            )}
        </div>
    );
}
