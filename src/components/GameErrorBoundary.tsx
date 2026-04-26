import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class GameErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[GameErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-slate-950 px-6 text-center text-white">
          <div className="text-lg font-bold">Game failed to start</div>
          <div className="max-w-md text-sm text-white/80 break-words">{this.state.error.message}</div>
          <button
            type="button"
            className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
