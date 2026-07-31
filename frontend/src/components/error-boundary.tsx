"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button } from "@/components/ui/button";

type ErrorBoundaryProps = {
  children: ReactNode;
  fallbackTitle?: string;
};

type ErrorBoundaryState = {
  error: Error | null;
};

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("UI error boundary caught:", error, info.componentStack);
  }

  private handleRetry = () => {
    this.setState({ error: null });
  };

  render() {
    if (this.state.error) {
      return (
        <div
          role="alert"
          className="m-8 flex max-w-lg flex-col gap-4 rounded-lg border border-destructive/30 bg-destructive/10 p-6"
        >
          <h2 className="text-lg font-semibold text-destructive">
            {this.props.fallbackTitle ?? "Something went wrong"}
          </h2>
          <p className="text-sm text-destructive">{this.state.error.message}</p>
          <Button type="button" variant="outline" onClick={this.handleRetry}>
            Try again
          </Button>
        </div>
      );
    }

    return this.props.children;
  }
}
