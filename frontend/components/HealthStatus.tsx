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
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <WifiOff className="w-4 h-4 animate-pulse" />
        <span className="text-sm">Connecting...</span>
      </div>
    );
  }

  if (!health) {
    return (
      <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span className="text-sm">Checking...</span>
      </div>
    );
  }

  const isHealthy = health.status === "healthy";

  return (
    <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-[#40414f] border border-gray-600">
      {/* Connection indicator */}
      {isConnected ? (
        <Wifi
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-green-500 shrink-0"
          aria-label="Connected"
        />
      ) : (
        <WifiOff
          className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-yellow-500 shrink-0 animate-pulse"
          aria-label="Reconnecting..."
        />
      )}

      {isHealthy ? (
        <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-500 shrink-0" />
      ) : (
        <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500 shrink-0" />
      )}
      <span className="text-xs sm:text-sm font-medium text-gray-300 whitespace-nowrap">
        <span className="text-[#10a37f]">{health.mcp_servers}</span>
        <span className="hidden sm:inline"> MCP servers</span>
        <span className="sm:hidden"> MCP</span>
      </span>
    </div>
  );
}
