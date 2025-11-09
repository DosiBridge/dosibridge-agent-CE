/**
 * Health status component
 */

'use client';

import { useStore } from '@/lib/store';
import { CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect } from 'react';

export default function HealthStatus() {
    const health = useStore((state) => state.health);
    const loadHealth = useStore((state) => state.loadHealth);

    useEffect(() => {
        loadHealth();
        const interval = setInterval(loadHealth, 30000); // Refresh every 30 seconds
        return () => clearInterval(interval);
    }, [loadHealth]);

    if (!health) {
        return (
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Checking...</span>
            </div>
        );
    }

    const isHealthy = health.status === 'healthy';

    return (
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#40414f] border border-gray-600">
            {isHealthy ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
            ) : (
                <XCircle className="w-4 h-4 text-red-500" />
            )}
            <span className="text-sm font-medium text-gray-300">
                <span className="capitalize">{health.status}</span>
                <span className="mx-2">•</span>
                <span className="text-[#10a37f]">{health.mcp_servers}</span> MCP servers
            </span>
        </div>
    );
}

