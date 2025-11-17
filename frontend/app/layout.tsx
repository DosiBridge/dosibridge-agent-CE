import { ErrorBoundary } from "@/components/ErrorBoundary";
import RuntimeConfigLoader from "@/components/RuntimeConfigLoader";
import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";

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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
        suppressHydrationWarning
      >
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
                
                console.error = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('beacon.min.js') || 
                      message.includes('ERR_BLOCKED_BY_CLIENT') ||
                      message.includes('cloudflareinsights.com') ||
                      message.includes('static.cloudflareinsights.com')) {
                    return; // Suppress these errors
                  }
                  originalError.apply(console, args);
                };
                
                console.warn = function(...args) {
                  const message = args.join(' ');
                  if (message.includes('beacon.min.js') || 
                      message.includes('ERR_BLOCKED_BY_CLIENT') ||
                      message.includes('cloudflareinsights.com') ||
                      message.includes('static.cloudflareinsights.com')) {
                    return; // Suppress these warnings
                  }
                  originalWarn.apply(console, args);
                };
                
                // Suppress unhandled errors for blocked resources
                window.addEventListener('error', function(e) {
                  if (e.message && (
                    e.message.includes('beacon.min.js') ||
                    e.message.includes('ERR_BLOCKED_BY_CLIENT') ||
                    e.message.includes('cloudflareinsights.com') ||
                    e.message.includes('static.cloudflareinsights.com')
                  )) {
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
                      reason.includes('static.cloudflareinsights.com')) {
                    e.preventDefault();
                    return false;
                  }
                });
              })();
            `,
          }}
        />
        <RuntimeConfigLoader />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  );
}
