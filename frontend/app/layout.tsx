import { ErrorBoundary } from "@/components/ErrorBoundary";
import RuntimeConfigLoader from "@/components/RuntimeConfigLoader";
import ThemeProvider from "@/components/ThemeProvider";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import StarBackground from "@/components/StarBackground";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import MiniAgentChatbot from "@/components/MiniAgentChatbot";
import AuthProvider from "@/components/auth/AuthProvider";
import ScrollToTop from "@/components/ui/ScrollToTop";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "DosiBridge Agent - AI-Powered Assistant",
  description:
    "Intelligent AI agent with MCP tools and RAG capabilities. Upload documents, ask questions, and get intelligent responses.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#030014] text-white min-h-screen relative`}
        suppressHydrationWarning
      >
        <StarBackground />

        {/* Initialize theme before React hydration to prevent flash */}
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  const stored = localStorage.getItem('theme');
                  // Force dark mode for space theme if needed, or stick to system
                  // For this UI overhaul, we prefer dark/space theme.
                  document.documentElement.classList.add('dark');
                } catch (e) {
                  document.documentElement.classList.add('dark');
                }
              })();
            `,
          }}
        />
        {/* Suppress console errors and network errors for blocked resources (e.g., ad blockers) */}
        <Script
          id="suppress-blocked-resource-errors"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Suppress console errors for blocked resources
                const originalError = console.error;
                const originalWarn = console.warn;
                const originalLog = console.log;
                
                // Override console methods to filter blocked resource errors
                console.error = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('beacon.min.js') || 
                      message.includes('ERR_BLOCKED_BY_CLIENT') ||
                      message.includes('cloudflareinsights.com') ||
                      message.includes('static.cloudflareinsights.com') ||
                      message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
                    return; // Suppress these errors
                  }
                  originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('beacon.min.js') || 
                      message.includes('ERR_BLOCKED_BY_CLIENT') ||
                      message.includes('cloudflareinsights.com') ||
                      message.includes('static.cloudflareinsights.com') ||
                      message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
                    return; // Suppress these warnings
                  }
                  originalWarn.apply(console, args);
                };
                
                console.log = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('beacon.min.js') || 
                      message.includes('ERR_BLOCKED_BY_CLIENT') ||
                      message.includes('cloudflareinsights.com') ||
                      message.includes('static.cloudflareinsights.com') ||
                      message.includes('net::ERR_BLOCKED_BY_CLIENT')) {
                    return; // Suppress these logs
                  }
                  originalLog.apply(console, args);
                };
                
                // Suppress unhandled errors for blocked resources
                window.addEventListener('error', function(e) {
                  const errorMessage = e.message || e.filename || e.target?.src || '';
                  if (errorMessage.includes('beacon.min.js') ||
                      errorMessage.includes('ERR_BLOCKED_BY_CLIENT') ||
                      errorMessage.includes('cloudflareinsights.com') ||
                      errorMessage.includes('static.cloudflareinsights.com') ||
                      errorMessage.includes('net::ERR_BLOCKED_BY_CLIENT')) {
                    e.preventDefault();
                    e.stopPropagation();
                    e.stopImmediatePropagation();
                    return false;
                  }
                }, true);
                
                // Suppress network errors for blocked resources
                window.addEventListener('unhandledrejection', function(e) {
                  const reason = e.reason?.message || e.reason?.toString() || '';
                  if (reason.includes('beacon.min.js') || 
                      reason.includes('ERR_BLOCKED_BY_CLIENT') ||
                      reason.includes('cloudflareinsights.com') ||
                      reason.includes('static.cloudflareinsights.com') ||
                      reason.includes('net::ERR_BLOCKED_BY_CLIENT')) {
                    e.preventDefault();
                    return false;
                  }
                });
                
                // Intercept fetch requests to suppress errors for blocked resources
                const originalFetch = window.fetch;
                window.fetch = function(...args) {
                  const url = args[0]?.toString() || '';
                  if (url.includes('cloudflareinsights.com') || 
                      url.includes('beacon.min.js')) {
                    // Return a rejected promise that we'll catch
                    return Promise.reject(new Error('Blocked by ad blocker'));
                  }
                  return originalFetch.apply(this, args).catch(function(error) {
                    const errorMsg = error?.message || error?.toString() || '';
                    if (errorMsg.includes('ERR_BLOCKED_BY_CLIENT') ||
                        errorMsg.includes('cloudflareinsights.com') ||
                        errorMsg.includes('beacon.min.js')) {
                      // Suppress the error
                      return Promise.resolve(new Response(null, { status: 200 }));
                    }
                    throw error;
                  });
                };
              })();
            `,
          }}
        />
        <ThemeProvider />
        <RuntimeConfigLoader />
        <AuthProvider>
          <ImpersonationBanner />
          <MiniAgentChatbot />
          <ScrollToTop />
          <ErrorBoundary>{children}</ErrorBoundary>
        </AuthProvider>
      </body>
    </html>
  );
}
