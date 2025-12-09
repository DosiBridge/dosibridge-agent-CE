import React, { useState, useEffect } from "react";
import { Plus, Trash2, Tag, Loader2, FolderOpen } from "lucide-react";
import { DocumentCollection } from "@/types/api";
import { createCollection, listCollections, deleteCollection } from "@/lib/api/documents";
import toast from "react-hot-toast";
import { cn } from "@/lib/utils";

interface CollectionManagerProps {
    onCollectionsChange?: () => void;
}

export default function CollectionManager({ onCollectionsChange }: CollectionManagerProps) {
    const [collections, setCollections] = useState<DocumentCollection[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isCreating, setIsCreating] = useState(false);

    // Form state
    const [showForm, setShowForm] = useState(false);
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");

    const loadCollections = async () => {
        setIsLoading(true);
        try {
            const res = await listCollections();
            setCollections(res.collections);
        } catch (error) {
            console.error("Failed to load collections:", error);
            toast.error("Failed to load collections");
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        loadCollections();
    }, []);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim()) return;

        setIsCreating(true);
        try {
            await createCollection(name, description);
            toast.success("Collection created");
            setName("");
            setDescription("");
            setShowForm(false);
            loadCollections();
            onCollectionsChange?.();
        } catch (error) {
            // @ts-ignore
            toast.error(error.message || "Failed to create collection");
        } finally {
            setIsCreating(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!confirm("Are you sure? This will not delete the documents, only the collection tag.")) return;

        try {
            await deleteCollection(id);
            toast.success("Collection deleted");
            loadCollections();
            onCollectionsChange?.();
        } catch (error) {
            toast.error("Failed to delete collection");
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-semibold text-white">Document Collections</h3>
                    <p className="text-sm text-zinc-400">Group your documents into collections for targeted search.</p>
                </div>
                {!showForm && (
                    <button
                        onClick={() => setShowForm(true)}
                        className="bg-zinc-800 hover:bg-zinc-700 text-white px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        New Collection
                    </button>
                )}
            </div>

            {showForm && (
                <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
                    <h4 className="text-white font-medium mb-4">Create New Collection</h4>
                    <form onSubmit={handleCreate} className="space-y-4">
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Name</label>
                            <input
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="e.g. Finance Docs"
                                autoFocus
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-zinc-400 mb-1">Description (Optional)</label>
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-white text-sm focus:ring-2 focus:ring-indigo-500 outline-none"
                                placeholder="Documents related to Q1 financial reports"
                            />
                        </div>
                        <div className="flex gap-3 pt-2">
                            <button
                                type="submit"
                                disabled={isCreating || !name.trim()}
                                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2"
                            >
                                {isCreating && <Loader2 className="w-3 h-3 animate-spin" />}
                                Create Collection
                            </button>
                            <button
                                type="button"
                                onClick={() => setShowForm(false)}
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
            ) : collections.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {collections.map((col) => (
                        <div key={col.id} className="bg-zinc-900/30 border border-zinc-800 rounded-xl p-4 flex items-center justify-between group hover:border-zinc-700 transition-colors">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                                    <FolderOpen className="w-5 h-5" />
                                </div>
                                <div>
                                    <h4 className="text-white font-medium">{col.name}</h4>
                                    {col.description && (
                                        <p className="text-xs text-zinc-500 truncate max-w-[200px]">{col.description}</p>
                                    )}
                                </div>
                            </div>

                            <button
                                onClick={() => handleDelete(col.id)}
                                className="p-2 text-zinc-500 hover:text-red-400 hover:bg-zinc-800 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                title="Delete collection"
                            >
                                <Trash2 className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="text-center py-12 text-zinc-500 border border-dashed border-zinc-800 rounded-xl">
                    <FolderOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                    <p>No collections created yet.</p>
                </div>
            )}
        </div>
    );
}
