import { AlertTriangle, RefreshCw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
	title?: string;
	message?: string;
	onRetry?: () => void;
	retryLabel?: string;
	className?: string;
}

/**
 * Shared "couldn't load" state. Never render an empty state when a fetch
 * fails — render this instead so failure is never mistaken for "no data".
 */
export function ErrorState({
	title = "Something went wrong",
	message = "We couldn't load your data. Check your connection and try again.",
	onRetry,
	retryLabel = "Try again",
	className,
}: ErrorStateProps) {
	return (
		<Card
			className={cn("border-destructive/30 bg-destructive/5", className)}
			role="alert"
		>
			<CardContent className="flex flex-col items-center gap-3 p-8 text-center">
				<div className="flex h-11 w-11 items-center justify-center rounded-full bg-destructive/10">
					<AlertTriangle className="h-5 w-5 text-destructive" aria-hidden="true" />
				</div>
				<div className="space-y-1">
					<p className="font-medium text-foreground">{title}</p>
					<p className="text-sm text-muted-foreground">{message}</p>
				</div>
				{onRetry && (
					<Button variant="outline" size="sm" onClick={onRetry}>
						<RefreshCw className="mr-2 h-4 w-4" aria-hidden="true" />
						{retryLabel}
					</Button>
				)}
			</CardContent>
		</Card>
	);
}
