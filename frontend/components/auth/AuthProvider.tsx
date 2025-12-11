"use client";

import { Auth0Provider, useAuth0 } from "@auth0/auth0-react";
import { useRouter } from "next/navigation";
import { ReactNode, useEffect } from "react";
import { setAuthToken } from "@/lib/api/client";
import { useStore } from "@/lib/store";

function AuthSynchronizer({ children }: { children: ReactNode }) {
    const { isAuthenticated, getAccessTokenSilently, user, isLoading } = useAuth0();
    const { checkAuth, setImpersonatedUserId } = useStore();

    useEffect(() => {
        const syncAuth = async () => {
            if (isAuthenticated) {
                try {
                    const token = await getAccessTokenSilently({
                        authorizationParams: {
                            audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE,
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
    }, [isAuthenticated, getAccessTokenSilently, checkAuth, isLoading]);

    return <>{children}</>;
}

export default function AuthProvider({ children }: { children: ReactNode }) {
    const router = useRouter();

    const domain = process.env.NEXT_PUBLIC_AUTH0_DOMAIN;
    const clientId = process.env.NEXT_PUBLIC_AUTH0_CLIENT_ID;
    const audience = process.env.NEXT_PUBLIC_AUTH0_AUDIENCE;

    const onRedirectCallback = (appState: any) => {
        router.push(appState?.returnTo || window.location.pathname);
    };

    if (!(domain && clientId)) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-red-950 text-white p-4">
                <div className="bg-red-900 border border-red-700 p-6 rounded-lg max-w-lg">
                    <h2 className="text-xl font-bold mb-2">Configuration Error</h2>
                    <p>Auth0 is not configured. Please set the following environment variables:</p>
                    <ul className="list-disc list-inside mt-2 font-mono text-sm">
                        <li>NEXT_PUBLIC_AUTH0_DOMAIN</li>
                        <li>NEXT_PUBLIC_AUTH0_CLIENT_ID</li>
                    </ul>
                </div>
            </div>
        );
    }

    return (
        <Auth0Provider
            domain={domain}
            clientId={clientId}
            authorizationParams={{
                redirect_uri: typeof window !== "undefined" ? window.location.origin : undefined,
                audience: audience,
            }}
            onRedirectCallback={onRedirectCallback}
            cacheLocation="localstorage"
        >
            <AuthSynchronizer>{children}</AuthSynchronizer>
        </Auth0Provider>
    );
}
