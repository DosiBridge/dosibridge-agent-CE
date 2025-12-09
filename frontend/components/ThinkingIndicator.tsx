/**
 * Thinking indicator component - shows status and active tools
 * Similar to ChatGPT's thinking/answering indicator
 */

"use client";

import { useStore } from "@/lib/store";
import { Loader2, Sparkles, Wrench, MessageSquare } from "lucide-react";
import { useEffect, useState } from "react";

export default function ThinkingIndicator() {
  const streamingStatus = useStore((state) => state.streamingStatus);
  const activeTools = useStore((state) => state.activeTools);
  const isStreaming = useStore((state) => state.isStreaming);
  const streamingStartTime = useStore((state) => state.streamingStartTime);

  const [elapsedTime, setElapsedTime] = useState<number | null>(null);
  const [isExpanded, setIsExpanded] = useState(true);

  // Update elapsed time
  useEffect(() => {
    if (!isStreaming || !streamingStartTime) {
      setElapsedTime(null);
      return;
    }

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - streamingStartTime) / 1000);
      setElapsedTime(seconds);
    }, 1000);

    return () => clearInterval(interval);
  }, [isStreaming, streamingStartTime]);

  // Collapse automatically when answering starts
  useEffect(() => {
    if (streamingStatus === "answering") {
      setIsExpanded(false);
    }
  }, [streamingStatus]);

  if (!isStreaming || !streamingStatus) {
    return null;
  }

  return (
    <div className="max-w-4xl mx-auto w-full px-1 sm:px-2 mb-3 sm:mb-4">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--surface-elevated)]/50 backdrop-blur-sm overflow-hidden animate-fade-in shadow-sm">
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-[var(--surface-hover)] transition-colors"
        >
          <div className="flex items-center gap-2 text-[var(--text-primary)] font-medium">
            <div className="relative flex h-2 w-2">
              <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${streamingStatus === 'answering' ? 'bg-[var(--green)]' : 'bg-amber-500'}`}></span>
              <span className={`relative inline-flex rounded-full h-2 w-2 ${streamingStatus === 'answering' ? 'bg-[var(--green)]' : 'bg-amber-500'}`}></span>
            </div>
            {streamingStatus === "answering" ? "Finished Thinking" : "Reasoning"}
            {elapsedTime !== null && elapsedTime > 0 && (
              <span className="text-xs text-[var(--text-secondary)] font-normal ml-1">
                ({elapsedTime}s)
              </span>
            )}
          </div>
          <div className={`text-[var(--text-secondary)] transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}>
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-chevron-down"><path d="m6 9 6 6 6-6" /></svg>
          </div>
        </button>

        {isExpanded && (
          <div className="px-4 pb-4 animate-in slide-in-from-top-2 duration-200">
            <div className="h-px w-full bg-[var(--border)] mb-3" />
            <div className="space-y-2.5">
              {activeTools.length > 0 ? (
                <>
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)] uppercase tracking-wider font-semibold">
                    <Wrench className="w-3 h-3" />
                    Tools Used
                  </div>
                  <div className="grid gap-2">
                    {activeTools.map((tool, index) => (
                      <div key={`${tool}-${index}`} className="flex items-center gap-2 text-sm text-[var(--text-primary)] bg-[var(--surface)] px-3 py-2 rounded-md border border-[var(--border)]">
                        <div className="w-1.5 h-1.5 rounded-full bg-[var(--green)]" />
                        {tool}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] italic">
                  <Sparkles className="w-4 h-4" />
                  Analyzing request...
                </div>
              )}
              {streamingStatus === "thinking" && (
                <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)] animate-pulse mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Thinking process active...
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
