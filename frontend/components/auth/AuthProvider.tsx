"use client";

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { setAuthToken, getRuntimeConfig } from "@/lib/api/client";
import { useStore } from "@/lib/store";

function AuthSynchronizer({ 
    children, 
    audience 
}: { 
    children: ReactNode;
    audience?: string;
}) {
    const { isAuthenticated, getAccessTokenSilently, user, isLoading } = useAuth0();
    const { checkAuth, setImpersonatedUserId } = useStore();

    useEffect(() => {
        const syncAuth = async () => {
            if (isAuthenticated) {
                try {
                    const token = await getAccessTokenSilently({
                        authorizationParams: {
                            audience: audience,
                            scope: "openid profile email"
                        }
                    });
                    // Store token in client config (and localStorage via client implementation)
                    setAuthToken(token);

                    // Trigger store to fetch full user profile from backend
                    await checkAuth();
                } catch (error) {
                    console.error("Failed to sync auth token:", error);
                }
            } else if (!isLoading) {
                // Not authenticated
                setAuthToken("", false); // Clear token
                await checkAuth(); // Will fail and clear store state
            }
        };

        syncAuth();
    }, [isAuthenticated, getAccessTokenSilently, checkAuth, isLoading, audience]);

    return <>{children}</>;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();
    const [authConfig, setAuthConfig] = useState<{
        domain?: string;
        clientId?: string;
        audience?: string;
    } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        // Load Auth0 config from runtime config
        const loadConfig = async () => {
            try {
                const config = await getRuntimeConfig();
                const domain = config?.AUTH0_DOMAIN || process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
                const clientId = config?.AUTH0_CLIENT_ID || process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
                const audience = config?.AUTH0_AUDIENCE || process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

                if (!domain || !clientId) {
                    setError("Auth0 configuration is missing");
                    setLoading(false);
                    return;
                }

                setAuthConfig({ domain, clientId, audience });
                setLoading(false);
            } catch (err) {
                console.error("Failed to load Auth0 config:", err);
                setError("Failed to load Auth0 configuration");
                setLoading(false);
            }
        };

        loadConfig();
    }, []);

    const onRedirectCallback = (appState: any) => {
        router.push(appState?.returnTo || window.location.pathname);
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-zinc-950 text-white p-4">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-4"></div>
                    <p>Loading configuration...</p>
                </div>
            </div>
        );
    }

    if (error || !authConfig?.domain || !authConfig?.clientId) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-950 text-white p-4">
                <div className="bg-red-900 border border-red-700 p-6 rounded-lg max-w-lg">
                    <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
                    <p>Auth0 is not configured. Please set the following environment variables:</p>
                    <ul className="list-disc list-inside mt-2 font-mono text-sm">
                        <li>NEXT_PUBLIC_AUTH0_DOMAIN or AUTH0_DOMAIN</li>
                        <li>NEXT_PUBLIC_AUTH0_CLIENT_ID or AUTH0_CLIENT_ID</li>
                    </ul>
                    {error && (
                        <p className="mt-4 text-sm text-red-300">Error: {error}</p>
                    )}
                </div>
            </div>
        );
    }

    return (
        <Auth0Provider
            domain={authConfig.domain}
            clientId={authConfig.clientId}
            authorizationParams={{
                redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
                audience: authConfig.audience,
            }}
            onRedirectCallback={onRedirectCallback}
            cacheLocation="localstorage"
        >
            <AuthSynchronizer audience={authConfig.audience}>{children}</AuthSynchronizer>
        </Auth0Provider>
    );
}
