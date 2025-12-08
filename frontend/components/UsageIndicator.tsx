/**
 * Usage Indicator Component - Shows daily request usage
 */
"use client";

import { useEffect, useState } from "react";
import { useStore } from "@/lib/store";
import { getTodayUsage, type TodayUsage } from "@/lib/api/monitoring";
import { Activity, AlertCircle } from "lucide-react";
import Link from "next/link";

export default function UsageIndicator() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const [usage, setUsage] = useState<TodayUsage | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }

    const loadUsage = async () => {
      try {
        const todayUsage = await getTodayUsage();
        setUsage(todayUsage);
      } catch (error) {
        console.error("Failed to load usage:", error);
      } finally {
        setLoading(false);
      }
    };

    loadUsage();
    // Refresh every 30 seconds
    const interval = setInterval(loadUsage, 30000);
    return () => clearInterval(interval);
  }, [isAuthenticated]);

  if (!isAuthenticated || loading || !usage) {
    return null;
  }

  const percentage = Math.round((usage.request_count / usage.limit) * 100);
  const isNearLimit = usage.request_count >= usage.limit * 0.8;
  const isExceeded = !usage.is_allowed;

  return (
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
        className={`text-xs font-medium ${
          isExceeded
            ? "text-red-500"
            : isNearLimit
            ? "text-amber-500"
            : "text-[var(--text-secondary)]"
        }`}
      >
        {usage.remaining}/{usage.limit}
      </span>
    </Link>
  );
}

