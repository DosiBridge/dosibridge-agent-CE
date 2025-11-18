/**
 * Command palette component (Cmd/Ctrl + K)
 */
"use client";

import { cn } from "@/lib/utils";
import { Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import Modal from "./Modal";

export interface CommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
  category?: string;
}

export interface CommandPaletteProps {
  items: CommandItem[];
  isOpen: boolean;
  onClose: () => void;
}

export default function CommandPalette({
  items,
  isOpen,
  onClose,
}: CommandPaletteProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredItems = items.filter((item) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const searchableText = [
      item.label,
      item.description,
      ...(item.keywords || []),
    ]
      .join(" ")
      .toLowerCase();
    return searchableText.includes(query);
  });

  // Group items by category
  const groupedItems = filteredItems.reduce((acc, item) => {
    const category = item.category || "General";
    if (!acc[category]) acc[category] = [];
    acc[category].push(item);
    return acc;
  }, {} as Record<string, CommandItem[]>);

  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (filteredItems.length > 0) {
      setSelectedIndex(0);
    }
  }, [searchQuery, filteredItems.length]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev < filteredItems.length - 1 ? prev + 1 : 0
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) =>
        prev > 0 ? prev - 1 : filteredItems.length - 1
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action();
        onClose();
      }
    } else if (e.key === "Escape") {
      onClose();
    }
  };

  const handleSelect = (item: CommandItem) => {
    item.action();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      size="lg"
      closeOnClickOutside={true}
      showCloseButton={false}
    >
      <div className="p-2" onKeyDown={handleKeyDown}>
        {/* Search Input */}
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-secondary)]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Type a command or search..."
            className="w-full pl-10 pr-10 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-primary)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-[var(--green)]"
            autoFocus
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-1 hover:bg-[var(--surface-hover)] rounded"
            >
              <X className="w-4 h-4 text-[var(--text-secondary)]" />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-96 overflow-y-auto">
          {filteredItems.length === 0 ? (
            <div className="text-center py-8 text-[var(--text-tertiary)]">
              <p className="text-sm">No commands found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(groupedItems).map(([category, categoryItems]) => (
                <div key={category}>
                  <div className="px-2 py-1 text-xs font-semibold text-[var(--text-tertiary)] uppercase">
                    {category}
                  </div>
                  <div className="space-y-1">
                    {categoryItems.map((item, index) => {
                      const globalIndex = filteredItems.indexOf(item);
                      const isSelected = globalIndex === selectedIndex;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelect(item)}
                          className={cn(
                            "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-all",
                            isSelected
                              ? "bg-[var(--green)] text-white"
                              : "hover:bg-[var(--surface-hover)] text-[var(--text-primary)]"
                          )}
                        >
                          {item.icon && (
                            <div className="shrink-0">{item.icon}</div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">
                              {item.label}
                            </div>
                            {item.description && (
                              <div
                                className={cn(
                                  "text-xs mt-0.5",
                                  isSelected
                                    ? "text-white/80"
                                    : "text-[var(--text-secondary)]"
                                )}
                              >
                                {item.description}
                              </div>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-4 border-t border-[var(--border)] flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-elevated)] rounded text-xs text-[var(--text-primary)]">
                ↑↓
              </kbd>
              <span>Navigate</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-elevated)] rounded text-xs text-[var(--text-primary)]">
                Enter
              </kbd>
              <span>Select</span>
            </div>
            <div className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-[var(--surface-elevated)] rounded text-xs text-[var(--text-primary)]">
                Esc
              </kbd>
              <span>Close</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
