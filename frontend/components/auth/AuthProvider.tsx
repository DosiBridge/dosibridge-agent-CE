"use client";

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { setAuthToken, removeAuthToken, getRuntimeConfig } from "@/lib/api/client";
import { useStore } from "@/lib/store";

function AuthSynchronizer({
    children,
    audience
}: {
    children: ReactNode;
    audience?: string;
}) {
    const { isAuthenticated, getAccessTokenSilently, user, isLoading } = useAuth0();
    const { checkAuth } = useStore();

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
                removeAuthToken(); // Clear token
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
        return <>{children}</>;
    }

    if (error || !authConfig?.domain || !authConfig?.clientId) {
        console.error(error || "Auth0 configuration is missing");
        return <>{children}</>;
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
