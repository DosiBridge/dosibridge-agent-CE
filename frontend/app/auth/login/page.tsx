"use client";

import { useAuth0 } from "@auth0/auth0-react";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Github, Chrome } from "lucide-react";
import AuthLayout from "@/components/auth/AuthLayout";
import SocialButton from "@/components/auth/SocialButton";
import { useStore } from "@/lib/store";

export default function LoginPage() {
    const { loginWithRedirect, isAuthenticated, isLoading, user } = useAuth0();
    const router = useRouter();
    const { user: storeUser, isAuthenticated: storeIsAuthenticated } = useStore();

    useEffect(() => {
        // Only redirect if user is authenticated AND active (not blocked)
        // The store's checkAuth will handle blocked users and clear their state
        if (isAuthenticated && user && storeIsAuthenticated && storeUser?.is_active) {
            router.push("/chat");
        } else if (isAuthenticated && user && storeUser && !storeUser.is_active) {
            // User is blocked - don't redirect, stay on login page
            // The error toast will be shown by checkAuth in AuthProvider
        }
    }, [isAuthenticated, user, storeUser, storeIsAuthenticated, router]);

    if (isLoading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-[#030014]">
                <Loader2 className="h-8 w-8 animate-spin text-purple-500" />
            </div>
        );
    }

    return (
        <AuthLayout
            headerTitle="Welcome Back"
            headerSubtitle="Sign in to your account to continue"
        >
            <div className="space-y-4">
                <SocialButton
                    provider="Google"
                    icon={<Chrome className="w-5 h-5" />}
                    onClick={() => loginWithRedirect({
                        authorizationParams: { connection: 'google-oauth2' }
                    })}
                />

                <SocialButton
                    provider="GitHub"
                    icon={<Github className="w-5 h-5" />}
                    onClick={() => loginWithRedirect({
                        authorizationParams: { connection: 'github' }
                    })}
                />

                <div className="relative my-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-[#030014] px-2 text-white/40">
                            Or
                        </span>
                    </div>
                </div>

                <button
                    onClick={() => loginWithRedirect()}
                    className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors"
                >
                    Sign In with Email
                </button>
            </div>
        </AuthLayout>
    );
}
