"use client";

import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { Button } from "~/ui/primitives/button";

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Custom fallback component */
  fallback?: ReactNode;
  /** Custom error handler */
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  /** Whether to show the full error message (dev only) */
  showDetails?: boolean;
}

interface ErrorBoundaryState {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  hasError: boolean;
}

/**
 * Error boundary component to catch rendering errors in React tree.
 * Prevents the entire app from crashing when a component throws.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { error: null, errorInfo: null, hasError: false };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return { error, hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    this.props.onError?.(error, errorInfo);
    // Log to error reporting service in production
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  handleReset = () => {
    this.setState({ error: null, errorInfo: null, hasError: false });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div
          className={`
          flex min-h-[400px] flex-col items-center justify-center p-8
        `}
        >
          <div className="flex flex-col items-center gap-4 text-center">
            <div
              className={`
              flex h-16 w-16 items-center justify-center rounded-full
              bg-destructive/10
            `}
            >
              <AlertTriangle className="h-8 w-8 text-destructive" />
            </div>
            <h2 className="text-xl font-semibold">Something went wrong</h2>
            <p className="max-w-md text-sm text-muted-foreground">
              We encountered an unexpected error. Please try refreshing the page
              or contact support if the problem persists.
            </p>
            {this.props.showDetails && this.state.error && (
              <details className="mt-4 max-w-md text-left">
                <summary className="cursor-pointer text-sm font-medium">
                  Error details
                </summary>
                <pre
                  className={`
                  mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs
                `}
                >
                  {this.state.error.message}
                  {this.state.errorInfo?.componentStack}
                </pre>
              </details>
            )}
            <div className="flex gap-3">
              <Button onClick={this.handleReset} variant="outline">
                Try again
              </Button>
              <Button onClick={this.handleReload}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Reload page
              </Button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

/**
 * Simple error fallback for pages.
 */
export function PageErrorFallback() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="flex flex-col items-center gap-4 text-center">
        <AlertTriangle className="h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-bold">Page Error</h1>
        <p className="text-muted-foreground">
          This page encountered an error. Please refresh or try again later.
        </p>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh Page
        </Button>
      </div>
    </div>
  );
}
