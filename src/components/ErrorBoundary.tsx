import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Last-resort error boundary so a render-time throw shows a recovery screen
 * instead of a blank white page. Wraps the whole app in main.tsx.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  override state = { hasError: false };

  static getDerivedStateFromError(): { hasError: boolean } {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface for debugging; no PII, no tokens.
    console.error('[arentim] render error', error, info.componentStack);
  }

  override render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <h1 className="font-display text-2xl font-medium text-text">Algo correu mal</h1>
        <p className="max-w-sm font-sans text-sm text-muted">
          Ocorreu um erro inesperado. Recarrega a página para continuar.
        </p>
        <button
          onClick={() => window.location.reload()}
          className="focus-ring rounded border border-gold/50 px-5 py-2 font-sans text-[11px] font-medium uppercase tracking-[0.18em] text-gold transition-colors hover:bg-gold hover:text-bg"
        >
          Recarregar
        </button>
      </div>
    );
  }
}
