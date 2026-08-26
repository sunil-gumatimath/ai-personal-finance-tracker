import { useState, useEffect } from "react";
import {
	Sparkles,
	AlertCircle,
	ChevronRight,
	Brain,
	Trophy,
	X,
	RefreshCw,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { Insight } from "@/hooks/useAIInsights";
import { cn } from "@/lib/utils";

interface AICoachProps {
	/**
	 * Insights are owned by the Dashboard's single useAIInsights instance and
	 * passed down, so the card and other consumers share one fetch + one
	 * dismissal state.
	 */
	insights: Insight[];
	isLoading: boolean;
	dismissInsight: (id: string) => Promise<void> | void;
	/** Set when insight loading failed — renders a slim retry row instead of vanishing. */
	error?: string | null;
	onRetry?: () => void;
}

const ROTATION_INTERVAL_MS = 8000;

export function AICoach({
	insights,
	isLoading,
	dismissInsight,
	error,
	onRetry,
}: AICoachProps) {
	const [currentIndex, setCurrentIndex] = useState(0);
	const [paused, setPaused] = useState(false);

	// No reset effect needed: the index is clamped defensively at render time
	// (below) and rotation wraps via modulo, so a stale index after a
	// dismissal can never read `undefined`.

	// Rotate only while there is something to rotate to AND the user isn't
	// reading (hover/focus-within pauses the timer).
	useEffect(() => {
		if (insights.length <= 1 || paused) return;
		const timer = setInterval(() => {
			setCurrentIndex((prev) => (prev + 1) % insights.length);
		}, ROTATION_INTERVAL_MS);
		return () => clearInterval(timer);
	}, [insights.length, paused]);

	// Loading skeleton
	if (isLoading) {
		return (
			<Card className="border-border/50 bg-card/50">
				<CardContent className="p-4">
					<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
						<Skeleton className="h-10 w-10 rounded-lg shrink-0" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-4 w-48" />
							<Skeleton className="h-3 w-64" />
						</div>
						<Skeleton className="h-8 w-20 rounded-md" />
					</div>
				</CardContent>
			</Card>
		);
	}

	// Fetch failed and nothing to show — slim retry row instead of silently
	// disappearing.
	if (insights.length === 0 && error) {
		return (
			<Card className="border-destructive/30 bg-destructive/5" role="alert">
				<CardContent className="flex items-center justify-between gap-3 p-3">
					<div className="flex min-w-0 items-center gap-2">
						<AlertCircle className="h-4 w-4 shrink-0 text-destructive" />
						<p className="truncate text-sm text-muted-foreground">
							Couldn&apos;t load your AI insights
						</p>
					</div>
					{onRetry && (
						<Button
							variant="outline"
							size="sm"
							className="h-7 shrink-0 text-xs"
							onClick={onRetry}
						>
							<RefreshCw className="mr-1.5 h-3 w-3" />
							Retry
						</Button>
					)}
				</CardContent>
			</Card>
		);
	}

	if (insights.length === 0) return null;

	// Clamp defensively at render time too (covers the single frame between a
	// dismissal and the reset effect running).
	const clampedIndex = Math.min(currentIndex, insights.length - 1);
	const currentInsight = insights[clampedIndex];
	if (!currentInsight) return null;

	const getIcon = (type: Insight["type"]) => {
		switch (type) {
			case "anomaly":
				return <AlertCircle className="h-4 w-4 text-destructive" />;
			case "kudo":
				return <Trophy className="h-4 w-4 text-[var(--income)]" />;
			case "coaching":
				return <Brain className="h-4 w-4 text-blue-500" />;
			default:
				return <Sparkles className="h-4 w-4 text-amber-500" />;
		}
	};

	const getTypeStyles = (type: Insight["type"]) => {
		switch (type) {
			case "anomaly":
				return "bg-destructive/10 text-destructive border-destructive/25 dark:bg-destructive/15";
			case "kudo":
				return "bg-[var(--income)]/10 text-[var(--income)] border-[var(--income)]/25";
			case "coaching":
				return "bg-blue-500/10 text-blue-500 border-blue-500/25 dark:bg-blue-500/15";
			default:
				return "bg-amber-500/10 text-amber-500 border-amber-500/25 dark:bg-amber-500/15";
		}
	};

	const getTypeLabel = (type: Insight["type"]) => {
		switch (type) {
			case "anomaly":
				return "Alert";
			case "kudo":
				return "Achievement";
			case "coaching":
				return "Tip";
			default:
				return "Insight";
		}
	};

	return (
		<Card
			className="relative overflow-hidden border border-border bg-card"
			onMouseEnter={() => setPaused(true)}
			onMouseLeave={() => setPaused(false)}
			onFocus={() => setPaused(true)}
			onBlur={() => setPaused(false)}
		>
			<CardContent className="p-4">
				<div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
					{/* Icon */}
					<div className="flex items-center gap-3 shrink-0">
						<div className="relative flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
							{getIcon(currentInsight.type)}
						</div>
					</div>

					{/* Content — keyed remount gives a short crossfade on swap */}
					<div
						key={clampedIndex}
						className="flex-1 min-w-0 space-y-1 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-[120ms]"
					>
						<div className="flex items-center gap-2">
							<Badge
								variant="outline"
								className={cn(
									"text-xs px-2 py-0 border font-medium rounded-full",
									getTypeStyles(currentInsight.type),
								)}
							>
								{getTypeLabel(currentInsight.type)}
							</Badge>
							<span className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground/60">
								AI Financial Coach
							</span>
						</div>
						<h3 className="text-sm font-semibold text-foreground truncate">
							{currentInsight.title}
						</h3>
						<p className="text-xs text-muted-foreground line-clamp-1">
							{currentInsight.description}
						</p>
					</div>

					{/* Actions */}
					<div className="flex items-center gap-3 shrink-0">
						{insights.length > 1 && (
							<div className="hidden sm:flex items-center gap-1.5 mr-2">
								{insights.map((_, i) => (
									<button
										key={i}
										type="button"
										aria-label={`Show insight ${i + 1} of ${insights.length}`}
										aria-current={clampedIndex === i}
										onClick={() => setCurrentIndex(i)}
										className={cn(
											"h-1.5 w-1.5 rounded-full transition-colors duration-200",
											clampedIndex === i
												? "bg-primary w-3"
												: "bg-muted-foreground/30 hover:bg-muted-foreground/50",
										)}
									/>
								))}
							</div>
						)}
						<Button
							size="sm"
							className="h-8 font-medium rounded-lg active:scale-[0.98]"
							onClick={() =>
								window.dispatchEvent(new CustomEvent("open-ai-chat"))
							}
						>
							Chat
							<ChevronRight className="ml-1 h-3.5 w-3.5" />
						</Button>
						<Button
							variant="ghost"
							size="icon"
							className="h-8 w-8 text-muted-foreground hover:text-foreground"
							aria-label="Dismiss this insight"
							title="Dismiss this insight"
							onClick={() => dismissInsight(currentInsight.id)}
						>
							<X className="h-3.5 w-3.5" />
						</Button>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}
