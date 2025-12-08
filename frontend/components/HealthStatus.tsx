/**
 * Health status component - uses WebSocket for real-time updates
 */

"use client";

import { useStore } from "@/lib/store";
import {
  HealthStatus as HealthStatusType,
  healthWebSocket,
} from "@/lib/websocket";
import { CheckCircle2, Loader2, Wifi, WifiOff, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

export default function HealthStatus() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const health = useStore((state) => state.health);
  const setHealth = useStore((state) => state.setHealth);
  const mcpServers = useStore((state) => state.mcpServers);
  const settingsOpen = useStore((state) => state.settingsOpen);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // Connect to WebSocket
    healthWebSocket.connect();

    // Subscribe to health status updates
    const unsubscribeHealth = healthWebSocket.onHealthStatus(
      (status: HealthStatusType) => {
        setHealth(status);
      }
    );

    // Subscribe to connection state changes
    const unsubscribeConnection = healthWebSocket.onConnectionState(
      (connected: boolean) => {
        setIsConnected(connected);
      }
    );

    // Cleanup on unmount
    return () => {
      unsubscribeHealth();
      unsubscribeConnection();
      // Don't disconnect here - let it stay connected for the app lifetime
      // healthWebSocket.disconnect();
    };
  }, [setHealth]);

  // Clear health status when logging out
  useEffect(() => {
    if (!isAuthenticated) {
      setHealth(null);
    }
  }, [isAuthenticated, setHealth]);

  // Ping WebSocket when MCP servers change or settings panel closes (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    if (!settingsOpen && isConnected) {
      // Settings panel just closed - ping for updated health status
      // Small delay to ensure backend has processed any MCP changes
      const timeoutId = setTimeout(() => {
        healthWebSocket.ping();
      }, 500);
      return () => clearTimeout(timeoutId);
    }
  }, [settingsOpen, isConnected, isAuthenticated]);

  // Ping WebSocket when MCP servers list changes (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    if (isConnected) {
      // MCP servers changed - ping immediately for updated health status
      // Also trigger a health check directly
      const loadHealth = useStore.getState().loadHealth;
      healthWebSocket.ping();
      // Also load health directly for immediate update
      loadHealth();
    }
  }, [mcpServers.length, isConnected, isAuthenticated]);

  // Don't show MCP count when not authenticated
  if (!isAuthenticated) {
    // Show simplified status without MCP info
    if (!isConnected && !health) {
      return (
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <WifiOff className="w-3 h-3 animate-pulse" />
          <span className="text-xs">Connecting...</span>
        </div>
      );
    }

    if (!health) {
      return (
        <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
          <Loader2 className="w-3 h-3 animate-spin" />
          <span className="text-xs">Checking...</span>
        </div>
      );
    }

    const isHealthy = health.status === "healthy";

    return (
      <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--surface-elevated)]/80 border border-[var(--border)] backdrop-blur-sm">
        {/* Connection indicator */}
        {isConnected ? (
          <Wifi
            className="w-3 h-3 text-[var(--success)] shrink-0"
            aria-label="Connected"
          />
        ) : (
          <WifiOff
            className="w-3 h-3 text-[var(--warning)] shrink-0 animate-pulse"
            aria-label="Reconnecting..."
          />
        )}

        {isHealthy ? (
          <CheckCircle2 className="w-3 h-3 text-[var(--success)] shrink-0" />
        ) : (
          <XCircle className="w-3 h-3 text-[var(--error)] shrink-0" />
        )}
        {/* No MCP count shown when not authenticated */}
      </div>
    );
  }

  // Show connection status when authenticated
  if (!isConnected && !health) {
    return (
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <WifiOff className="w-3 h-3 animate-pulse" />
        <span className="text-xs">Connecting...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-1.5 text-[var(--text-secondary)]">
        <Loader2 className="w-3 h-3 animate-spin" />
        <span className="text-xs">Checking...</span>
      </div>
    );
  }

  const isHealthy = health.status === "healthy";

  return (
    <div className="flex items-center gap-1 px-1.5 py-1 rounded-lg bg-[var(--surface-elevated)]/80 border border-[var(--border)] backdrop-blur-sm">
      {/* Connection indicator */}
      {isConnected ? (
        <Wifi
          className="w-3 h-3 text-[var(--success)] shrink-0"
          aria-label="Connected"
        />
      ) : (
        <WifiOff
          className="w-3 h-3 text-[var(--warning)] shrink-0 animate-pulse"
          aria-label="Reconnecting..."
        />
      )}

      {isHealthy ? (
        <CheckCircle2 className="w-3 h-3 text-[var(--success)] shrink-0" />
      ) : (
        <XCircle className="w-3 h-3 text-[var(--error)] shrink-0" />
      )}
      {/* Only show MCP count when authenticated */}
      {/* Use store count if available and more recent, otherwise use health count */}
      <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
        <span className="text-[var(--green)]">
          {mcpServers.length > 0 ? mcpServers.length : health.mcp_servers}
        </span>
        <span className="hidden sm:inline"> MCP</span>
      </span>
    </div>
  );
}
