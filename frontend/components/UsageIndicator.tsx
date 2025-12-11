/**
 * Usage Indicator Component - Shows daily request usage
 */
"use client";

import { useEffect, useState, useRef } from "react";
import { useStore } from "@/lib/store";
import { getTodayUsage, type TodayUsage } from "@/lib/api/monitoring";
import { Activity, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function UsageIndicator() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const isStreaming = useStore((state) => state.isStreaming);
  const [usage, setUsage] = useState<TodayUsage | null>(null);
  const [loading, setLoading] = useState(true);
  const prevStreamingRef = useRef<boolean>(false);

  const loadUsage = async () => {
    // Load usage for both authenticated and unauthenticated users
    try {
      const guestEmail = localStorage.getItem("guest_email") || undefined;
      const todayUsage = await getTodayUsage(guestEmail);
      setUsage(todayUsage);
    } catch (error) {
      console.error("Failed to load usage:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUsage();
    // Refresh every 10 seconds for more responsive updates
    const interval = setInterval(loadUsage, 10000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  // Refresh immediately when streaming stops (chat request completed)
  useEffect(() => {
    // When streaming transitions from true to false, a request just completed
    if (prevStreamingRef.current && !isStreaming) {
      // Small delay to ensure backend has recorded the usage
      const timeoutId = setTimeout(() => {
        loadUsage();
      }, 1000);
      prevStreamingRef.current = isStreaming;
      return () => clearTimeout(timeoutId);
    }

    // Update ref for next comparison
    prevStreamingRef.current = isStreaming;
  }, [isStreaming]);

  if (loading || !usage) {
    return null;
  }

  // Only show usage indicator if using default LLM
  // Users with custom API keys have unlimited requests, so no need to show limit
  if (!usage.is_default_llm || usage.limit === -1) {
    return null;
  }

  const percentage = Math.round((usage.request_count / usage.limit) * 100);
  const isNearLimit = usage.request_count >= usage.limit * 0.8;
  const isExceeded = !usage.is_allowed;

  return (
    <div className="flex items-center gap-2">
      <Link
        href="/monitoring"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-elevated)]/80 hover:bg-[var(--surface-hover)] transition-colors group"
        title={`${usage.remaining} requests remaining today (${usage.request_count}/${usage.limit} used)`}
      >
        {isExceeded ? (
          <AlertCircle className="w-3.5 h-3.5 text-red-500" />
        ) : isNearLimit ? (
          <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
        ) : (
          <Activity className="w-3.5 h-3.5 text-[var(--green)]" />
        )}
        <span
          className={`text-xs font-medium ${isExceeded
            ? "text-red-500"
            : isNearLimit
              ? "text-amber-500"
              : "text-[var(--text-secondary)]"
            }`}
        >
          {usage.remaining}/{usage.limit}
        </span>
      </Link>

      {/* Token Usage Indicator */}
      <Link
        href="/monitoring"
        className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-[var(--surface-elevated)]/80 hover:bg-[var(--surface-hover)] transition-colors group"
        title={`${usage.total_tokens.toLocaleString()} tokens used today`}
      >
        <span className="text-xs font-medium text-[var(--text-secondary)]">
          {(usage.total_tokens / 1000).toFixed(1)}k Tok
        </span>
      </Link>
    </div>
  );
}

