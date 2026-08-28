import { useCallback, useEffect, useState } from "react";
import {
	CalendarDays,
	Copy,
	Check,
	History,
	Lightbulb,
	MessageSquare,
	RefreshCw,
	Sparkles,
	TrendingUp,
	Calendar as CalendarIcon,
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { ApiError } from "@/lib/errors";
import { cn } from "@/lib/utils";
import type { AiDigest } from "@/types";

export function Digest() {
	const [digest, setDigest] = useState<AiDigest | null>(null);
	const [history, setHistory] = useState<AiDigest[]>([]);
	const [selectedDigestId, setSelectedDigestId] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);
	const [generating, setGenerating] = useState(false);
	const [copied, setCopied] = useState(false);
	const [period, setPeriod] = useState<"week" | "month" | "year" | "custom">("week");
	const [customDays, setCustomDays] = useState<number>(14);

	const loadDigests = useCallback(async () => {
		try {
			const res = await api.ai.digest.get();
			setDigest(res.digest);
			const list = res.history || (res.digest ? [res.digest] : []);
			setHistory(list);
			if (res.digest && !selectedDigestId) {
				setSelectedDigestId(res.digest.id);
			}
		} catch (error) {
			console.error("Failed to load digest history:", error);
		} finally {
			setLoading(false);
		}
	}, [selectedDigestId]);

	useEffect(() => {
		loadDigests();
	}, [loadDigests]);

	const generate = async () => {
		setGenerating(true);
		try {
			const payload = {
				period,
				days: period === "custom" ? customDays : undefined,
			};
			const { digest: fresh } = await api.ai.digest.generate(payload);
			setDigest(fresh);
			if (fresh) {
				setSelectedDigestId(fresh.id);
				setHistory((prev) => {
					const filtered = prev.filter((d) => d.id !== fresh.id && d.week_start !== fresh.week_start);
					return [fresh, ...filtered];
				});
			}
			toast.success(
				period === "week"
					? "Weekly digest generated successfully"
					: period === "month"
						? "Monthly digest generated successfully"
						: period === "year"
							? "Yearly digest generated successfully"
							: `${customDays}-day digest generated successfully`,
			);
		} catch (error) {
			console.error("Digest generation error:", error);
			const message =
				error instanceof ApiError
					? error.message
					: "Failed to generate the digest. Please check your AI API key in Settings.";
			toast.error(message);
		} finally {
			setGenerating(false);
		}
	};

	const activeDigest =
		history.find((d) => d.id === selectedDigestId) || digest;

	const handleCopy = async () => {
		if (!activeDigest?.content) return;
		try {
			await navigator.clipboard.writeText(activeDigest.content);
			setCopied(true);
			toast.success("Digest copied to clipboard");
			setTimeout(() => setCopied(false), 2000);
		} catch {
			toast.error("Failed to copy digest");
		}
	};

	const handleAskAi = () => {
		if (!activeDigest) return;
		window.dispatchEvent(
			new CustomEvent("open-ai-chat", {
				detail: {
					initialPrompt: `I'd like to discuss my Financial Digest for ${activeDigest.week_start}: \n\n${activeDigest.content.slice(0, 400)}...`,
				},
			}),
		);
	};

	if (loading) {
		return (
			<div className="space-y-6">
				<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
					<div className="space-y-1">
						<Skeleton className="h-8 w-48" />
						<Skeleton className="h-4 w-80" />
					</div>
					<Skeleton className="h-9 w-36" />
				</div>
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					<Card className="lg:col-span-3 border-border/50 bg-card/50">
						<CardHeader>
							<Skeleton className="h-6 w-56" />
							<Skeleton className="h-4 w-32" />
						</CardHeader>
						<CardContent className="space-y-4">
							<Skeleton className="h-4 w-full" />
							<Skeleton className="h-4 w-11/12" />
							<Skeleton className="h-4 w-4/5" />
							<Skeleton className="h-4 w-3/4" />
						</CardContent>
					</Card>
					<Card className="border-border/50 bg-card/50">
						<CardHeader>
							<Skeleton className="h-5 w-28" />
						</CardHeader>
						<CardContent className="space-y-3">
							<Skeleton className="h-10 w-full" />
							<Skeleton className="h-10 w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Page Header */}
			<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
				<div>
					<div className="flex items-center gap-2">
						<h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
							Financial AI Digest
						</h1>
						<Badge variant="outline" className="border-primary/30 text-primary text-xs">
							<Sparkles className="mr-1 h-3 w-3" />
							AI Report
						</Badge>
					</div>
					<p className="text-sm text-muted-foreground mt-0.5">
						Data-driven synthesis of your spending, budgets, goals, and multi-period progress.
					</p>
				</div>

				<div className="flex flex-wrap items-center gap-2">
					{activeDigest && (
						<>
							<Button
								variant="outline"
								size="sm"
								onClick={handleCopy}
								className="h-9"
							>
								{copied ? (
									<Check className="mr-1.5 h-4 w-4 text-emerald-500" />
								) : (
									<Copy className="mr-1.5 h-4 w-4" />
								)}
								{copied ? "Copied" : "Copy"}
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={handleAskAi}
								className="h-9"
							>
								<MessageSquare className="mr-1.5 h-4 w-4 text-primary" />
								Ask AI
							</Button>
						</>
					)}
					<Button
						onClick={generate}
						disabled={generating}
						size="sm"
						className="h-9 font-medium active:scale-[0.98]"
					>
						<RefreshCw
							className={cn(
								"mr-1.5 h-4 w-4",
								generating && "motion-safe:animate-spin",
							)}
						/>
						{generating ? "Synthesizing…" : activeDigest ? "Regenerate" : "Generate Digest"}
					</Button>
				</div>
			</div>

			{/* Timeframe Scope Selector */}
			<Card className="border-border/50 bg-card/40 backdrop-blur-sm p-4">
				<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
					<div className="flex items-center gap-2">
						<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
							Timeframe Scope:
						</span>
						<div className="inline-flex rounded-lg bg-muted/60 p-1">
							<button
								type="button"
								onClick={() => setPeriod("week")}
								className={cn(
									"px-3 py-1 text-xs font-medium rounded-md transition-all",
									period === "week"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Week (7d)
							</button>
							<button
								type="button"
								onClick={() => setPeriod("month")}
								className={cn(
									"px-3 py-1 text-xs font-medium rounded-md transition-all",
									period === "month"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Month (30d)
							</button>
							<button
								type="button"
								onClick={() => setPeriod("year")}
								className={cn(
									"px-3 py-1 text-xs font-medium rounded-md transition-all",
									period === "year"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Year (365d)
							</button>
							<button
								type="button"
								onClick={() => setPeriod("custom")}
								className={cn(
									"px-3 py-1 text-xs font-medium rounded-md transition-all",
									period === "custom"
										? "bg-background text-foreground shadow-sm"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								Custom Days
							</button>
						</div>
					</div>

					{period === "custom" && (
						<div className="flex items-center gap-2">
							<span className="text-xs text-muted-foreground">Days:</span>
							<input
								type="number"
								min="1"
								max="365"
								value={customDays}
								onChange={(e) => setCustomDays(Math.max(1, Number(e.target.value) || 1))}
								className="w-20 rounded-md border border-input bg-background px-2.5 py-1 text-xs focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
							/>
							<div className="flex items-center gap-1">
								{[14, 60, 90, 180].map((d) => (
									<button
										key={d}
										type="button"
										onClick={() => setCustomDays(d)}
										className={cn(
											"text-[10px] px-1.5 py-0.5 rounded border transition-colors",
											customDays === d
												? "border-primary text-primary bg-primary/10"
												: "border-border text-muted-foreground hover:text-foreground",
										)}
									>
										{d}d
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</Card>

			{!activeDigest && !generating ? (
				<Card className="border-border/50 bg-card/50 text-center py-12">
					<CardContent className="max-w-md mx-auto space-y-4">
						<div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
							<Sparkles className="h-6 w-6" />
						</div>
						<div className="space-y-1">
							<h3 className="text-lg font-semibold">No digests generated yet</h3>
							<p className="text-sm text-muted-foreground">
								Generate your first Weekly AI Digest to get a complete financial breakdown with automated anomaly detection, budget safety checks, and personalized coaching.
							</p>
						</div>
						<Button onClick={generate} className="mt-2 active:scale-[0.98]">
							<Sparkles className="mr-2 h-4 w-4" />
							Generate This Week&apos;s Digest
						</Button>
					</CardContent>
				</Card>
			) : (
				<div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
					{/* Main Digest View */}
					<Card className="lg:col-span-3 border-border/50 bg-card/50 shadow-sm">
						<CardHeader className="border-b border-border/40 pb-4">
							<div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
								<div>
									<CardTitle className="text-xl flex items-center gap-2">
										<TrendingUp className="h-5 w-5 text-primary" />
										Financial Intelligence Briefing
									</CardTitle>
									{activeDigest && (
										<CardDescription className="flex items-center gap-1.5 mt-1 text-xs">
											<CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
											Week of {activeDigest.week_start}
											<span className="text-muted-foreground/40">•</span>
											Generated {format(new Date(activeDigest.created_at), "MMM d, yyyy 'at' h:mm a")}
										</CardDescription>
									)}
								</div>
								<Badge variant="secondary" className="w-fit text-xs font-medium">
									7-Day Rolling Synthesis
								</Badge>
							</div>
						</CardHeader>
						<CardContent className="pt-6">
							{generating ? (
								<div className="space-y-4 py-4" aria-busy="true">
									<div className="flex items-center gap-2 text-sm text-primary font-medium">
										<Sparkles className="h-4 w-4 motion-safe:animate-spin" />
										Synthesizing accounts, budgets, and category spending…
									</div>
									<Skeleton className="h-4 w-full" />
									<Skeleton className="h-4 w-11/12" />
									<Skeleton className="h-4 w-4/5" />
									<Skeleton className="h-4 w-3/4" />
								</div>
							) : activeDigest ? (
								<div className="prose prose-sm dark:prose-invert max-w-none prose-p:my-2 prose-ul:my-2 prose-li:my-1 prose-strong:font-semibold prose-blockquote:my-2">
									<Markdown components={digestMarkdownComponents}>
										{activeDigest.content}
									</Markdown>
								</div>
							) : null}
						</CardContent>
					</Card>

					{/* Digest History Sidebar */}
					<div className="space-y-4">
						<Card className="border-border/50 bg-card/50">
							<CardHeader className="pb-3 border-b border-border/40">
								<CardTitle className="text-sm font-semibold flex items-center gap-2">
									<History className="h-4 w-4 text-muted-foreground" />
									Digest Archives
								</CardTitle>
								<CardDescription className="text-xs">
									Past weekly reports
								</CardDescription>
							</CardHeader>
							<CardContent className="pt-3 px-3 space-y-1.5">
								{history.length === 0 ? (
									<p className="text-xs text-muted-foreground py-2 text-center">
										No previous archives found.
									</p>
								) : (
									history.map((item) => {
										const isSelected = item.id === selectedDigestId;
										return (
											<button
												key={item.id}
												type="button"
												onClick={() => setSelectedDigestId(item.id)}
												className={cn(
													"w-full text-left rounded-lg p-2.5 transition-all text-xs flex flex-col gap-0.5",
													isSelected
														? "bg-primary/10 text-primary font-medium border border-primary/20"
														: "hover:bg-muted/60 text-muted-foreground hover:text-foreground",
												)}
											>
												<div className="flex items-center justify-between">
													<span className="font-semibold text-foreground">
														Week of {item.week_start}
													</span>
													{isSelected && (
														<span className="h-1.5 w-1.5 rounded-full bg-primary" />
													)}
												</div>
												<span className="text-[11px] text-muted-foreground flex items-center gap-1">
													<CalendarIcon className="h-3 w-3" />
													{format(new Date(item.created_at), "MMM d, yyyy")}
												</span>
											</button>
										);
									})
								)}
							</CardContent>
						</Card>

						{/* Quick AI Coaching Tip Card */}
						<Card className="border-primary/20 bg-primary/5">
							<CardContent className="p-4 space-y-2">
								<div className="flex items-center gap-1.5 text-xs font-semibold text-primary">
									<Lightbulb className="h-4 w-4" />
									Pro Tip
								</div>
								<p className="text-xs text-muted-foreground leading-relaxed">
									Weekly digests refresh each Monday with fresh goal progress, debt tracking, and category shifts. Use the &quot;Ask AI&quot; button to dive deeper into any callout.
								</p>
							</CardContent>
						</Card>
					</div>
				</div>
			)}
		</div>
	);
}

const digestMarkdownComponents: Components = {
	h2: ({ children }) => (
		<h2 className="mt-6 mb-2.5 flex items-center gap-2 border-b border-border/60 pb-1.5 text-sm font-bold uppercase tracking-wider text-primary first:mt-0">
			{children}
		</h2>
	),
	ul: ({ children }) => (
		<ul className="my-2 list-disc space-y-1 pl-5 marker:text-muted-foreground/60">
			{children}
		</ul>
	),
	blockquote: ({ children }) => (
		<blockquote className="my-4 flex gap-3 rounded-xl border border-primary/25 bg-primary/5 p-3.5 text-sm text-foreground/90 shadow-sm">
			<Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
			<div className="space-y-1">{children}</div>
		</blockquote>
	),
};
