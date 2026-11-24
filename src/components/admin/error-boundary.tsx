"use client";

import { Component, type ReactNode } from "react";

/**
 * Catches render/action errors inside one admin widget (e.g. the media
 * picker) and shows an inline retry box instead of letting the error reach
 * the route's error boundary — which would replace the whole admin page
 * with "Application error: a client-side exception has occurred".
 *
 * Server Action dispatches that reject (oversized body, a dropped
 * connection, a sleeping free-tier instance) surface here: the widget
 * fails, the rest of the form stays usable, and "Thử lại" remounts it.
 * Nothing is saved by the retry; the form keeps its unsaved state.
 */
export class ErrorBoundary extends Component<
  { message?: string; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error): { error: Error } {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error("[admin] widget crashed, showing inline fallback", error);
  }

  render(): ReactNode {
    if (this.state.error) {
      return (
        <div role="alert" className="border border-line bg-surface p-4">
          <p className="text-[12px]">{this.props.message ?? "Đã xảy ra lỗi. Hãy thử lại."}</p>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="btn btn-outline btn-sm mt-3"
          >
            Thử lại
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
