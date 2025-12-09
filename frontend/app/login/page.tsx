/**
 * Login page
 */
"use client";

import { useStore } from "@/lib/store";
import { Bot, Loader2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Spotlight } from "@/components/ui/Spotlight";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const handleLogin = useStore((state) => state.handleLogin);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const validateForm = (): string | null => {
    if (!email.trim()) {
      return "Email is required";
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      return "Please enter a valid email address";
    }
    if (!password) {
      return "Password is required";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Client-side validation
    const validationError = validateForm();
    if (validationError) {
      toast.error(validationError);
      return;
    }

    setLoading(true);

    try {
      await handleLogin({ email: email.trim(), password });
      toast.success("Logged in successfully!", {
        duration: 2000, // Auto-hide after 2 seconds
      });
      router.push("/chat");
    } catch (error: any) {
      // Extract error message from backend response
      const errorMessage =
        error?.message ||
        error?.detail ||
        error?.toString() ||
        "Login failed. Please check your email and password.";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6 lg:px-8 relative z-10 bg-black/[0.96] antialiased bg-grid-white/[0.02] overflow-hidden">
      <Spotlight
        className="-top-40 left-0 md:left-60 md:-top-20"
        fill="white"
      />
      <div className="max-w-md w-full">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 group">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <Bot className="w-7 h-7 text-white" />
            </div>
            <div className="flex flex-col text-left">
              <span className="text-2xl font-bold text-gradient-space">
                DosiBridge Agent
              </span>
              <span className="text-xs text-gray-400">by dosibridge.com</span>
            </div>
          </Link>
        </div>

        {/* Login Form */}
        <div className="glass-card rounded-2xl p-8 shadow-2xl backdrop-blur-xl">
          <h1 className="text-2xl font-bold mb-2 text-center text-white">Welcome Back</h1>
          <p className="text-gray-400 text-center mb-8">
            Sign in to access your intelligent agent workspace
          </p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
                autoComplete="email"
                className="w-full px-4 py-3 bg-[#1a1b38]/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-300 mb-2"
              >
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
                autoComplete="current-password"
                className="w-full px-4 py-3 bg-[#1a1b38]/50 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
                placeholder="••••••••"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl font-semibold transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed shadow-lg shadow-indigo-500/20 flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                "Sign In"
              )}
            </button>
          </form>

          <div className="mt-8 text-center">
            <p className="text-gray-400 text-sm">
              Don't have an account?{" "}
              <Link
                href="/register"
                className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors"
              >
                Create one
              </Link>
            </p>
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/"
              className="text-sm text-gray-500 hover:text-indigo-400 transition-colors inline-flex items-center gap-1"
            >
              <span>←</span> Back to home
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
