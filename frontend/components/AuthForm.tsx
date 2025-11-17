"use client";

import { useStore } from "@/lib/store";
import { Loader2, Lock, Mail, User as UserIcon } from "lucide-react";
import { useState } from "react";
import toast from "react-hot-toast";

export default function AuthForm() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = useStore((state) => state.handleLogin);
  const handleRegister = useStore((state) => state.handleRegister);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        await handleLogin({ email, password });
        toast.success("Logged in successfully!");
      } else {
        if (!name.trim()) {
          toast.error("Name is required");
          setLoading(false);
          return;
        }
        if (password.length < 8) {
          toast.error("Password must be at least 8 characters");
          setLoading(false);
          return;
        }
        await handleRegister({ email, password, name });
        toast.success("Registered successfully!");
      }
    } catch (error: any) {
      toast.error(error.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-[var(--surface)] to-[var(--surface-hover)] p-4">
      <div className="w-full max-w-md">
        <div className="bg-[var(--modal-bg)] rounded-2xl shadow-2xl p-8 border border-[var(--border)]">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold text-[var(--text-inverse)] mb-2">
              AI MCP Agent
            </h1>
            <p className="text-[var(--text-secondary)]">
              {isLogin ? "Sign in to continue" : "Create your account"}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {!isLogin && (
              <div>
                <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                  Name
                </label>
                <div className="relative">
                  <UserIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] w-5 h-5" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-inverse)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent"
                    placeholder="Enter your name"
                    required={!isLogin}
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] w-5 h-5" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-inverse)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent"
                  placeholder="Enter your email"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[var(--text-primary)] mb-2">
                Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-[var(--text-secondary)] w-5 h-5" />
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-[var(--input-bg)] border border-[var(--input-border)] rounded-lg text-[var(--text-inverse)] placeholder-[var(--text-tertiary)] focus:outline-none focus:ring-2 focus:ring-[var(--green)] focus:border-transparent"
                  placeholder="Enter your password"
                  required
                  minLength={isLogin ? undefined : 8}
                />
              </div>
              {!isLogin && (
                <p className="mt-1 text-xs text-[var(--text-secondary)]">
                  Password must be at least 8 characters
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 bg-[var(--green)] hover:bg-[var(--green-hover)] text-[var(--text-inverse)] font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {isLogin ? "Signing in..." : "Creating account..."}
                </>
              ) : isLogin ? (
                "Sign In"
              ) : (
                "Create Account"
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => {
                setIsLogin(!isLogin);
                setEmail("");
                setPassword("");
                setName("");
              }}
              className="text-[#10a37f] hover:text-[#0d8f6e] text-sm font-medium transition-colors"
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : "Already have an account? Sign in"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
