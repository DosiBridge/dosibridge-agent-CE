/**
 * API client - centralized exports
 *
 * This module re-exports all API clients and types for convenient importing.
 * Use specific imports for better tree-shaking:
 *   import { login } from "@/lib/api/auth"
 *   import type { User } from "@/types/api"
 */

// Re-export all API clients
export * from "./auth";
export * from "./chat";
export * from "./client";
export * from "./documents";
export * from "./health";
export * from "./llm";
export * from "./mcp";
export * from "./monitoring";
export * from "./sessions";
export * from "./tools";

// Re-export types for convenience
export * from "@/types/api";
