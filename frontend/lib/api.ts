/**
 * API client for backend communication
 *
 * @deprecated This file is kept for backward compatibility.
 * Please use the new modular structure:
 *   - Types: import from "@/types/api"
 *   - API clients: import from "@/lib/api/{auth|chat|documents|...}"
 *
 * This file re-exports everything from the new structure.
 */

// Re-export everything from the new modular structure
export * from "./api/index";
