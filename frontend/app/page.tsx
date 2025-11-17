/**
 * Landing page - Home page for DosiBridge Agent
 */
"use client";

import { useStore } from "@/lib/store";
import { ArrowRight, Bot, FileText, Lock, Sparkles, Zap } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

export default function Home() {
  const isAuthenticated = useStore((state) => state.isAuthenticated);
  const authLoading = useStore((state) => state.authLoading);
  const checkAuth = useStore((state) => state.checkAuth);

  useEffect(() => {
    // Check authentication status
    checkAuth();
  }, [checkAuth]);

  useEffect(() => {
    // Smooth scroll behavior
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = "auto";
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0a0a0a] via-[#1a1a1a] to-[#0a0a0a] text-white">
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-[#0a0a0a]/80 backdrop-blur-md border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <Link href="/" className="flex items-center gap-2 group">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#0d8f6e] flex items-center justify-center shadow-lg group-hover:shadow-xl transition-shadow">
                <Bot className="w-6 h-6 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-lg font-bold bg-gradient-to-r from-[#10a37f] to-[#0d8f6e] bg-clip-text text-transparent">
                  DosiBridge Agent
                </span>
                <span className="text-xs text-gray-400">by dosibridge.com</span>
              </div>
            </Link>

            {/* Navigation Links */}
            <div className="hidden md:flex items-center gap-8">
              <a
                href="#features"
                className="text-gray-300 hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="text-gray-300 hover:text-white transition-colors"
              >
                How It Works
              </a>
              <a
                href="#about"
                className="text-gray-300 hover:text-white transition-colors"
              >
                About
              </a>
            </div>

            {/* Auth Buttons - Only show when not authenticated */}
            {!authLoading && !isAuthenticated && (
              <div className="flex items-center gap-3">
                <Link
                  href="/login"
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white transition-colors"
                >
                  Log in
                </Link>
                <Link
                  href="/register"
                  className="px-4 py-2 text-sm font-medium bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-all hover:scale-105 active:scale-95"
                >
                  Create Account
                </Link>
              </div>
            )}
            {/* Show chat link when authenticated */}
            {!authLoading && isAuthenticated && (
              <div className="flex items-center gap-3">
                <Link
                  href="/chat"
                  className="px-4 py-2 text-sm font-medium bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-all hover:scale-105 active:scale-95"
                >
                  Go to Chat
                </Link>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <div className="mb-8 inline-flex items-center gap-2 px-4 py-2 bg-[#10a37f]/10 border border-[#10a37f]/30 rounded-full text-[#10a37f] text-sm font-medium">
            <Sparkles className="w-4 h-4" />
            <span>AI-Powered Agentic Assistant</span>
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-bold mb-6 bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent leading-tight">
            Your Intelligent
            <br />
            <span className="bg-gradient-to-r from-[#10a37f] to-[#0d8f6e] bg-clip-text text-transparent">
              AI Assistant
            </span>
          </h1>

          <p className="text-xl sm:text-2xl text-gray-400 mb-12 max-w-3xl mx-auto leading-relaxed">
            Powered by advanced AI agents and RAG technology. Upload documents,
            ask questions, and get intelligent responses with tool integration.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/chat"
              className="group px-8 py-4 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl flex items-center gap-2"
            >
              Get Started
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <a
              href="https://dosibridge.com"
              target="_blank"
              rel="noopener noreferrer"
              className="px-8 py-4 border border-gray-700 hover:border-gray-600 text-gray-300 hover:text-white rounded-lg font-semibold text-lg transition-all"
            >
              Learn More
            </a>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section
        id="features"
        className="py-20 px-4 sm:px-6 lg:px-8 bg-[#0f0f0f]"
      >
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Everything you need for intelligent conversations and document
              analysis
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <Bot className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">AI Agent Mode</h3>
              <p className="text-gray-400">
                Interact with intelligent AI agents that can use tools, access
                external APIs, and perform complex tasks.
              </p>
            </div>

            {/* Feature 2 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <FileText className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">
                RAG Document Analysis
              </h3>
              <p className="text-gray-400">
                Upload your documents and ask questions. Get accurate answers
                based on your document content using RAG technology.
              </p>
            </div>

            {/* Feature 3 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <Zap className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Fast & Responsive</h3>
              <p className="text-gray-400">
                Real-time streaming responses, WebSocket health monitoring, and
                optimized performance for the best experience.
              </p>
            </div>

            {/* Feature 4 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <Lock className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Secure & Private</h3>
              <p className="text-gray-400">
                Your data is encrypted and private. Each user&apos;s documents
                and sessions are completely isolated.
              </p>
            </div>

            {/* Feature 5 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <Sparkles className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">Smart Suggestions</h3>
              <p className="text-gray-400">
                Get intelligent query suggestions, input history navigation, and
                context-aware assistance.
              </p>
            </div>

            {/* Feature 6 */}
            <div className="p-6 bg-[#1a1a1a] border border-gray-800 rounded-xl hover:border-[#10a37f]/50 transition-all group">
              <div className="w-12 h-12 rounded-lg bg-[#10a37f]/10 flex items-center justify-center mb-4 group-hover:bg-[#10a37f]/20 transition-colors">
                <Bot className="w-6 h-6 text-[#10a37f]" />
              </div>
              <h3 className="text-xl font-semibold mb-2">MCP Integration</h3>
              <p className="text-gray-400">
                Connect to Model Context Protocol servers for extended
                functionality and custom tool integration.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-4">
              How It Works
            </h2>
            <p className="text-xl text-gray-400 max-w-2xl mx-auto">
              Simple steps to get started with DosiBridge Agent
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#10a37f] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                1
              </div>
              <h3 className="text-xl font-semibold mb-2">Create Account</h3>
              <p className="text-gray-400">
                Sign up for free to access RAG mode and document upload
                features.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#10a37f] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                2
              </div>
              <h3 className="text-xl font-semibold mb-2">Upload Documents</h3>
              <p className="text-gray-400">
                Upload your PDFs, text files, or documents to create your
                knowledge base.
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 rounded-full bg-[#10a37f] flex items-center justify-center text-2xl font-bold mx-auto mb-4">
                3
              </div>
              <h3 className="text-xl font-semibold mb-2">Ask Questions</h3>
              <p className="text-gray-400">
                Switch to RAG mode and ask questions about your documents. Get
                instant, accurate answers.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8 bg-gradient-to-r from-[#10a37f]/10 to-[#0d8f6e]/10">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6">
            Ready to Get Started?
          </h2>
          <p className="text-xl text-gray-400 mb-8">
            Join DosiBridge Agent today and experience the future of AI-powered
            assistance.
          </p>
          <Link
            href="/chat"
            className="inline-flex items-center gap-2 px-8 py-4 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg font-semibold text-lg transition-all hover:scale-105 active:scale-95 shadow-lg hover:shadow-xl"
          >
            Get Started Free
            <ArrowRight className="w-5 h-5" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer
        id="about"
        className="py-12 px-4 sm:px-6 lg:px-8 border-t border-gray-800"
      >
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#10a37f] to-[#0d8f6e] flex items-center justify-center">
                <Bot className="w-5 h-5 text-white" />
              </div>
              <span className="text-gray-400">
                DosiBridge Agent by{" "}
                <a
                  href="https://dosibridge.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#10a37f] hover:text-[#0d8f6e] transition-colors"
                >
                  dosibridge.com
                </a>
              </span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-400">
              <a
                href="#features"
                className="hover:text-white transition-colors"
              >
                Features
              </a>
              <a
                href="#how-it-works"
                className="hover:text-white transition-colors"
              >
                How It Works
              </a>
              {!authLoading && !isAuthenticated && (
                <>
                  <Link
                    href="/login"
                    className="hover:text-white transition-colors"
                  >
                    Log in
                  </Link>
                  <Link
                    href="/register"
                    className="hover:text-white transition-colors"
                  >
                    Sign Up
                  </Link>
                </>
              )}
              {!authLoading && isAuthenticated && (
                <Link
                  href="/chat"
                  className="hover:text-white transition-colors"
                >
                  Chat
                </Link>
              )}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
