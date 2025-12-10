/**
 * Login page
 */
"use client";

import { useStore } from "@/lib/store";
import { Bot, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { BackgroundBeams } from "@/components/ui/background-beams";
import Input from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [persistentAccess, setPersistentAccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const handleLogin = useStore((state) => state.handleLogin);

  useEffect(() => {
    if (isAuthenticated) {
      router.push("/chat");
    }
  }, [isAuthenticated, router]);

  const validateForm = (): string | null => {
    if (!email.trim()) return "Email is required";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return "Invalid email address";
    if (!password) return "Password is required";
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validateForm();
    if (error) {
      toast.error(error);
      return;
    }

    setLoading(true);
    try {
      await handleLogin({ email: email.trim(), password }, persistentAccess);
      toast.success("Welcome back!");
      router.push("/chat");
    } catch (error: any) {
      const msg = error?.message || "Login failed. Please check your credentials.";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 relative flex flex-col items-center justify-center p-4 overflow-hidden antialiased">
      <BackgroundBeams className="opacity-50" />

      <div className="relative z-10 w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8 space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 group mb-6">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 shadow-lg shadow-indigo-500/20 group-hover:shadow-indigo-500/40 transition-shadow">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">
              DosiBridge Agent
            </span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-white/90">
            Welcome back
          </h1>
          <p className="text-zinc-400 text-sm">
            Sign in to your intelligent workspace
          </p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900/50 backdrop-blur-xl border border-white/10 p-8 rounded-2xl shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="Ex. john@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                {/* Optional: Add Forgot Password link here later */}
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>

            {/* Persistent Access Option (for superadmin) */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="persistent-access"
                checked={persistentAccess}
                onChange={(e) => setPersistentAccess(e.target.checked)}
                disabled={loading}
                className="w-4 h-4 rounded border-white/20 bg-white/5 text-indigo-600 focus:ring-2 focus:ring-indigo-500 focus:ring-offset-0 cursor-pointer"
              />
              <Label htmlFor="persistent-access" className="text-sm text-zinc-300 cursor-pointer">
                Enable persistent access (Superadmin only)
              </Label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-lg font-medium transition-all shadow-lg shadow-indigo-500/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Sign In"}
            </button>
          </form>

          <div className="mt-8 text-center text-sm">
            <span className="text-zinc-400">Don't have an account? </span>
            <Link href="/register" className="text-indigo-400 hover:text-indigo-300 font-medium transition-colors">
              Create an account
            </Link>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link href="/" className="text-xs text-zinc-500 hover:text-zinc-300 flex items-center justify-center gap-1 transition-colors">
            <ArrowLeft className="w-3 h-3" />
            Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
