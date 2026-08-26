import {
	Component,
	useContext,
	type ErrorInfo,
	type ReactNode,
} from "react";
import { useNavigate, UNSAFE_NavigationContext } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "./Logo";

interface Props {
	children?: ReactNode;
}

interface State {
	hasError: boolean;
	error: Error | null;
}

/**
 * Top-level crash containment. Used twice:
 *  1. main.tsx      — wraps the whole app (outside the router).
 *  2. App.tsx       — wraps MainLayout so a broken route can never blank
 *                     out the app shell.
 *
 * The class API is intentionally kept minimal (children + reset via state);
 * all presentation lives in `ErrorFallback` below.
 */
export class ErrorBoundary extends Component<Props, State> {
	public state: State = {
		hasError: false,
		error: null,
	};

	public static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error };
	}

	public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
		console.error("Uncaught error:", error, errorInfo);
	}

	private handleReset = () => {
		this.setState({ hasError: false, error: null });
	};

	public render() {
		if (this.state.hasError) {
			return (
				<ErrorFallback error={this.state.error} onReset={this.handleReset} />
			);
		}

		return this.props.children;
	}
}

function ErrorFallback({
	error,
	onReset,
}: {
	error: Error | null;
	onReset: () => void;
}) {
	// The root boundary in main.tsx sits OUTSIDE <BrowserRouter>, so router
	// hooks must only mount when a navigator actually exists.
	const navigation = useContext(UNSAFE_NavigationContext);

	return (
		<div className="flex min-h-screen w-full flex-col items-center justify-center bg-background p-4 text-foreground">
			<Card className="w-full max-w-md">
				<CardContent className="flex flex-col items-center gap-5 p-8 text-center">
					<Logo size="md" showText={false} />
					<div className="space-y-2">
						<h1 className="text-xl font-semibold tracking-tight">
							Something went wrong
						</h1>
						<p className="text-sm text-muted-foreground">
							An unexpected error interrupted this page. Your data is safe —
							try again, or head back to your dashboard.
						</p>
					</div>
					<div className="flex flex-wrap items-center justify-center gap-2">
						<Button variant="outline" onClick={onReset}>
							Try again
						</Button>
						{navigation ? (
							<GoToDashboardButton onAfterNavigate={onReset} />
						) : (
							<Button
								variant="ghost"
								onClick={() => window.location.assign("/")}
							>
								Go to dashboard
							</Button>
						)}
					</div>
					{error?.message ? (
						<details className="w-full text-left">
							<summary className="cursor-pointer text-xs font-medium text-muted-foreground transition-colors hover:text-foreground">
								Technical details
							</summary>
							<pre className="mt-2 max-h-40 overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre-wrap text-muted-foreground">
								{error.message}
							</pre>
						</details>
					) : null}
				</CardContent>
			</Card>
		</div>
	);
}

/**
 * "Go to dashboard" for boundaries INSIDE the router — client-side navigate,
 * then clear the error so the destination renders.
 */
function GoToDashboardButton({ onAfterNavigate }: { onAfterNavigate: () => void }) {
	const navigate = useNavigate();

	return (
		<Button
			variant="ghost"
			onClick={() => {
				navigate("/", { replace: true });
				onAfterNavigate();
			}}
		>
			Go to dashboard
		</Button>
	);
}
