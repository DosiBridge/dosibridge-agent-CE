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
  const health = useStore((state) => state.health);
  const setHealth = useStore((state) => state.setHealth);
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

  // Show connection status
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
      <span className="text-xs font-medium text-[var(--text-primary)] whitespace-nowrap">
        <span className="text-[var(--green)]">{health.mcp_servers}</span>
        <span className="hidden sm:inline"> MCP</span>
      </span>
    </div>
  );
}
