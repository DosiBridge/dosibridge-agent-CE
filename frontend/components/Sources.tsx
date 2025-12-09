/**
 * Component to display RAG sources as a grid of cards
 */

"use client";

import { FileText, Link as LinkIcon, ExternalLink } from "lucide-react";

interface Source {
    title: string;
    url?: string;
}

interface SourcesProps {
    sources: Source[];
}

export default function Sources({ sources }: SourcesProps) {
    if (!sources || sources.length === 0) return null;

    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 mt-2 mb-4 w-full max-w-4xl">
            {sources.map((source, idx) => (
                <a
                    key={idx}
                    href={source.url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2.5 p-3 rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 hover:bg-[var(--surface-hover)] transition-all duration-200 group no-underline text-left select-none"
                >
                    <div className="shrink-0 flex items-center justify-center w-8 h-8 rounded-lg bg-[var(--surface)] border border-[var(--border)] group-hover:border-[var(--green)]/30 group-hover:bg-[var(--green)]/5 transition-colors">
                        {source.url ? (
                            <LinkIcon className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--green)] transition-colors" />
                        ) : (
                            <FileText className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-[var(--green)] transition-colors" />
                        )}
                    </div>
                    <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--text-primary)] truncate group-hover:text-[var(--green)] transition-colors">
                            {source.title}
                        </div>
                        {source.url && (
                            <div className="text-xs text-[var(--text-secondary)] truncate">
                                {new URL(source.url).hostname}
                            </div>
                        )}
                    </div>
                    <ExternalLink className="w-3 h-3 text-[var(--text-secondary)] opacity-0 group-hover:opacity-100 transition-all -translate-x-1 group-hover:translate-x-0" />
                </a>
            ))}
        </div>
    );
}
