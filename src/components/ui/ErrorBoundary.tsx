
import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
    children?: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null,
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="flex flex-col items-center justify-center min-h-screen p-4 bg-background text-foreground">
                    <h1 className="text-2xl font-bold mb-4 text-destructive">Something went wrong</h1>
                    <div className="bg-card p-4 rounded-lg border border-border max-w-lg w-full overflow-auto">
                        <p className="font-mono text-sm whitespace-pre-wrap text-destructive/90">
                            {this.state.error?.message}
                        </p>
                        <p className="mt-4 text-sm text-muted-foreground">
                            Check the console for more details.
                        </p>
                    </div>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-4 py-2 bg-primary text-primary-foreground rounded hover:opacity-90 transition-opacity"
                    >
                        Reload Page
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}
