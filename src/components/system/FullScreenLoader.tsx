import { Loader2 } from "lucide-react";

import { Logo } from "./Logo";
import { cn } from "@/lib/utils";

interface FullScreenLoaderProps {
	label?: string;
	className?: string;
}

/**
 * Branded full-page loading state. Replaces the three ad-hoc spinner blocks
 * that used to live in App.tsx / route guards / page loaders.
 */
export function FullScreenLoader({ label = "Loading…", className }: FullScreenLoaderProps) {
	return (
		<div
			className={cn(
				"flex min-h-svh w-full flex-col items-center justify-center gap-4 bg-background",
				className,
			)}
			role="status"
			aria-live="polite"
		>
			<Logo size="md" />
			<Loader2 className="h-6 w-6 animate-spin motion-safe:animate-spin text-muted-foreground" />
			<span className="sr-only">{label}</span>
		</div>
	);
}
