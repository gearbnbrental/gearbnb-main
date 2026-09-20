import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Last-resort catch for a render-time exception anywhere below it — most importantly, a failed
 * lazy route chunk (`React.lazy()` + `Suspense` only handle the *loading* state; a rejected
 * dynamic import, e.g. "Failed to fetch dynamically imported module" on a flaky mobile connection
 * or a stale cached page after a redeploy, throws during Suspense resolution). Without something
 * catching that, React unmounts the entire tree with no visible explanation — a fully blank page.
 *
 * No external logging service — the exception only ever goes to the browser console via
 * componentDidCatch, same as React's own default behavior. The customer-facing fallback is always
 * the same generic message; the error/stack itself is additionally rendered on-page, but only when
 * `import.meta.env.DEV` is true (never in a production build) — added specifically so an error
 * happening on a mobile device that can't easily reach DevTools can still be read directly off the
 * screen during local development, without exposing any detail to a real customer.
 */
export default class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null, errorInfo: null };

  static getDerivedStateFromError(error: Error): Pick<ErrorBoundaryState, 'hasError' | 'error'> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Console only — never sent anywhere, never shown to a real customer (see render() below).
    console.error('ErrorBoundary caught an error:', error, errorInfo);
    this.setState({ errorInfo });
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-5 py-10 text-center sm:px-6">
        <h1 className="font-serif text-xl font-semibold text-ink">Something went wrong</h1>
        <p className="max-w-sm text-sm text-ink-muted">
          This page couldn&rsquo;t load properly. This is usually temporary — reloading the page
          should fix it.
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="rounded-lg bg-brand-forest px-6 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-forest-dark"
        >
          Reload Page
        </button>
        {import.meta.env.DEV && this.state.error && (
          <pre className="mt-4 max-w-full overflow-x-auto whitespace-pre-wrap break-words rounded-lg border border-red-300 bg-red-50 p-3 text-left text-xs text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-400">
            {this.state.error.name}: {this.state.error.message}
            {'\n'}
            {this.state.error.stack}
            {this.state.errorInfo && `\n\nComponent stack:${this.state.errorInfo.componentStack}`}
          </pre>
        )}
      </div>
    );
  }
}
