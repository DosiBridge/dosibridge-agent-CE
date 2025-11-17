/**
 * Global loading component for route transitions
 */
"use client";

import LoadingSpinner from "@/components/LoadingSpinner";

export default function Loading() {
  return (
    <div className="min-h-screen bg-[#343541] dark:bg-[#2d2d2f] flex items-center justify-center">
      <LoadingSpinner size="lg" text="Loading..." />
    </div>
  );
}
