/**
 * Error Boundary Component
 * Catches React errors and displays a user-friendly error message
 */

"use client";

import { AlertTriangle, Home, RefreshCw } from "lucide-react";
import { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log error to console in development
    if (process.env.NODE_ENV === "development") {
      console.error("ErrorBoundary caught an error:", error, errorInfo);
    }

    // In production, you could log to an error reporting service
    // Example: logErrorToService(error, errorInfo);

    this.setState({
      error,
      errorInfo,
    });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = "/";
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen flex items-center justify-center bg-[var(--background)] p-4">
          <div className="max-w-2xl w-full bg-[var(--modal-bg)] rounded-xl shadow-2xl border border-[var(--border)] p-6 sm:p-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full bg-[var(--error)]/20 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-[var(--error)]" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold text-[var(--text-primary)]">
                  Something went wrong
                </h1>
                <p className="text-sm text-[var(--text-secondary)] mt-1">
                  An unexpected error occurred
                </p>
              </div>
            </div>

            {process.env.NODE_ENV === "development" && this.state.error && (
              <div className="mb-6 p-4 bg-[var(--surface-hover)] rounded-lg border border-[var(--border)]">
                <p className="text-sm font-mono text-[var(--error)] mb-2">
                  {this.state.error.toString()}
                </p>
                {this.state.errorInfo && (
                  <details className="mt-2">
                    <summary className="text-xs text-[var(--text-secondary)] cursor-pointer hover:text-[var(--text-primary)]">
                      Stack trace
                    </summary>
                    <pre className="mt-2 text-xs text-gray-500 overflow-auto max-h-48">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  </details>
                )}
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#10a37f] hover:bg-[#0d8f6e] text-white rounded-lg transition-colors font-medium"
              >
                <RefreshCw className="w-4 h-4" />
                Try Again
              </button>
              <button
                onClick={this.handleReload}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#40414f] hover:bg-[#4a4b5a] text-white rounded-lg transition-colors font-medium border border-gray-600"
              >
                <RefreshCw className="w-4 h-4" />
                Reload Page
              </button>
              <button
                onClick={this.handleGoHome}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#40414f] hover:bg-[#4a4b5a] text-white rounded-lg transition-colors font-medium border border-gray-600"
              >
                <Home className="w-4 h-4" />
                Go Home
              </button>
            </div>

            <p className="mt-6 text-xs text-gray-500 text-center">
              If this problem persists, please contact support or try refreshing
              the page.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
