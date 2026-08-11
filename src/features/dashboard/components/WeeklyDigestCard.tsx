import { useCallback, useEffect, useState } from "react";
import {
	CalendarDays,
	Eye,
	EyeOff,
	Lightbulb,
	RefreshCw,
	Sparkles,
} from "lucide-react";
import { format } from "date-fns";
import Markdown from "react-markdown";
import type { Components } from "react-markdown";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import type { AiDigest } from "@/types";

/** localStorage key persisting whether the digest body is hidden. */
const DIGEST_HIDDEN_KEY = "weekly-digest-hidden";

/**
 * Weekly AI digest card: shows the latest AI-generated summary of the week
 * (spending, budgets, goals, debts) with a generate/regenerate action and a
 * show/hide toggle that collapses the digest body once it has been generated.
 */
export function WeeklyDigestCard() {
	const [digest, setDigest] = useState<AiDigest | null>(null);
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [hidden, setHidden] = useState<boolean>(() => {
		try {
			return localStorage.getItem(DIGEST_HIDDEN_KEY) === "1";
		} catch {
			return false;
		}
	});

	const toggleHidden = useCallback(() => {
		setHidden((prev) => {
			const next = !prev;
			try {
				localStorage.setItem(DIGEST_HIDDEN_KEY, next ? "1" : "0");
			} catch {
				/* storage unavailable — keep in-memory only */
			}
			return next;
		});
	}, []);

	const loadDigest = useCallback(async () => {
		try {
			const { digest: stored } = await api.ai.digest.get();
			setDigest(stored);
		} catch (error) {
			console.error("Failed to load digest:", error);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadDigest();
	}, [loadDigest]);

	const generate = async () => {
		setGenerating(true);
		try {
			const { digest: fresh } = await api.ai.digest.generate();
			setDigest(fresh);
			toast.success("Weekly digest generated");
		} catch (error) {
			console.error("Digest generation error:", error);
			const message =
				error instanceof ApiError
					? error.message
					: "Failed to generate the digest";
			toast.error(message);
		} finally {
			setGenerating(false);
		}
	};

	if (loading) {
		return (
			<Card className="border-border/50 bg-card/50">
				<CardContent className="p-5">
					<div className="flex items-center gap-3">
						<Skeleton className="h-9 w-9 rounded-lg shrink-0" />
						<div className="flex-1 space-y-2">
							<Skeleton className="h-4 w-32" />
							<Skeleton className="h-3 w-56" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	if (!digest && !generating) {
		return (
			<Card className="border-border/50 bg-card/50">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Weekly AI Digest
					</CardTitle>
					<CardDescription>
						A one-page summary of your week: spending, budgets, goals and debt —
						generated from your actual data.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<Button onClick={generate}>
						<Sparkles className="mr-2 h-4 w-4" />
						Generate this week&apos;s digest
					</Button>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className="border-border/50 bg-card/50">
			<CardHeader className="flex flex-row items-start justify-between gap-2">
				<div>
					<CardTitle className="flex items-center gap-2">
						<Sparkles className="h-5 w-5 text-primary" />
						Weekly AI Digest
					</CardTitle>
					<CardDescription className="flex items-center gap-1.5">
						<CalendarDays className="h-3.5 w-3.5" />
						Week of{" "}
						{digest ? format(new Date(digest.week_start), "MMM d, yyyy") : ""}
						{digest?.created_at &&
							` · updated ${format(new Date(digest.created_at), "MMM d, HH:mm")}`}
					</CardDescription>
				</div>
				<div className="flex items-center gap-2">
					{digest && (
						<Button
							variant="ghost"
							size="icon"
							onClick={toggleHidden}
							aria-label={hidden ? "Show digest" : "Hide digest"}
							title={hidden ? "Show digest" : "Hide digest"}
						>
							{hidden ? (
								<Eye className="h-4 w-4" />
							) : (
								<EyeOff className="h-4 w-4" />
							)}
						</Button>
					)}
					<Button
						variant="outline"
						size="sm"
						onClick={generate}
						disabled={generating}
					>
						<RefreshCw
							className={`mr-2 h-3.5 w-3.5 ${generating ? "animate-spin" : ""}`}
						/>
						{generating ? "Generating…" : "Regenerate"}
					</Button>
				</div>
			</CardHeader>
			<CardContent>
				{hidden ? (
					<p className="text-sm text-muted-foreground">
						Digest hidden — click the eye icon to show it again.
					</p>
				) : digest ? (
					<div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-1.5 prose-ul:my-1.5 prose-li:my-1 prose-strong:font-semibold prose-blockquote:my-0">
						<Markdown components={digestMarkdownComponents}>
							{digest.content}
						</Markdown>
					</div>
				) : (
					<p className="text-sm text-muted-foreground">
						Generating your digest…
					</p>
				)}
			</CardContent>
		</Card>
	);
}

/**
 * Markdown rendering rules tuned for the digest layout:
 * - h2 section headings: compact, uppercase-ish accent look.
 * - blockquote (the Tip): highlighted callout with a lightbulb icon.
 */
const digestMarkdownComponents: Components = {
	h2: ({ children }) => (
		<h2 className="mt-5 mb-2 flex items-center gap-2 border-b border-border/60 pb-1.5 text-xs font-semibold uppercase tracking-wider text-primary first:mt-0">
			{children}
		</h2>
	),
	ul: ({ children }) => (
		<ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-muted-foreground/50">
			{children}
		</ul>
	),
	blockquote: ({ children }) => (
		<blockquote className="my-3 flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm text-foreground/90">
			<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
			<div className="space-y-1">{children}</div>
		</blockquote>
	),
};
