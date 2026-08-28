import { useState } from "react";
import { ChevronDown, ChevronRight, Plus, ScrollText, User, X } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { ErrorState } from "@/components/system/ErrorState";
import { cn } from "@/lib/utils";
import {
	formatAction,
	formatTimestamp,
	generateHumanDescription,
	type FormatOptions,
} from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";
import {
	getActionColor,
	getActionIconComponent,
	getSeverityConfig,
} from "./log-visuals";

const PAGE_SIZE = 50;

interface LogTimelineProps {
	logs: LogEntry[];
	loading: boolean;
	onSelectLog: (log: LogEntry) => void;
	onClearFilters: () => void;
	/** Fetch error message — renders ErrorState instead of the empty state. */
	error?: string | null;
	onRetry?: () => void;
	/** Currency/locale threaded from user preferences. */
	formatOptions?: FormatOptions;
}

/** Activity timeline card: loading skeleton, live rows, and empty states. */
export function LogTimeline({
	logs,
	loading,
	onSelectLog,
	onClearFilters,
	error,
	onRetry,
	formatOptions,
}: LogTimelineProps) {
	const [displayLimit, setDisplayLimit] = useState(PAGE_SIZE);
	const visibleLogs = logs.slice(0, displayLimit);
	const hasMore = logs.length > displayLimit;

	return (
		<Card className="overflow-hidden py-0 gap-0">
			<CardHeader className="border-b bg-muted/30 px-6 py-4 [.border-b]:pb-4">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base font-semibold">
							Activity Timeline
						</CardTitle>
						<CardDescription className="mt-1">
							{logs.length} {logs.length === 1 ? "entry" : "entries"} found
						</CardDescription>
					</div>
				</div>
			</CardHeader>
			<CardContent className="p-0">
				{loading ? (
					<div className="p-4 space-y-1">
						{Array.from({ length: 6 }).map((_, i) => (
							<div
								key={i}
								className="flex items-center gap-4 p-4 motion-safe:animate-pulse"
								style={{ animationDelay: `${i * 80}ms` }}
							>
								<div className="h-10 w-10 rounded-full bg-muted shrink-0 ring-4 ring-background" />
								<div className="flex-1 space-y-2">
									<div className="h-4 bg-muted rounded-md w-2/5" />
									<div className="h-3.5 bg-muted rounded-md w-3/5" />
								</div>
								<div className="space-y-2 text-right shrink-0">
									<div className="h-3.5 bg-muted rounded-md w-14 ml-auto" />
									<div className="h-3 bg-muted rounded-md w-20 ml-auto" />
								</div>
							</div>
						))}
					</div>
				) : error && logs.length === 0 ? (
					// Fetch failed with nothing to show — never dress failure up as
					// an empty state; offer a retry.
					<ErrorState
						title="Couldn't load activity logs"
						message={error}
						onRetry={onRetry}
						className="border-0 bg-transparent"
					/>
				) : visibleLogs.length > 0 ? (
					<div className="relative">
						{/* Vertical timeline line bounded cleanly within item margins */}
						<div className="absolute left-[36px] top-6 bottom-6 w-px bg-border/60 hidden sm:block" />

						{visibleLogs.map((log, index) => {
							const timeInfo = formatTimestamp(log.timestamp);
							const description = generateHumanDescription(
								log,
								formatOptions,
							);
							const actionColors = getActionColor(log.action);
							const severityConfig = getSeverityConfig(log.severity);
							const IconComponent = getActionIconComponent(log.action);

							return (
								<div
									key={log.id}
									role="button"
									tabIndex={0}
									aria-label={`${formatAction(log.action)} — view details`}
									onClick={() => onSelectLog(log)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											onSelectLog(log);
										}
									}}
									className={cn(
										"group relative flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-[background-color,transform] duration-150 ease-out hover:bg-muted/40 active:bg-muted/60 active:scale-[0.995] focus-visible:bg-muted/40 focus-visible:outline-none",
										// Staggered entrance; delays capped at 300ms.
										"motion-safe:animate-fade-in-up",
									)}
									style={{
										animationDelay: `${Math.min(index * 30, 300)}ms`,
										animationFillMode: "both",
									}}
								>
									{/* Icon node with opaque ring preventing timeline rail bleed-through */}
									<div
										className={cn(
											"relative z-10 flex items-center justify-center h-10 w-10 rounded-full border shrink-0 bg-background ring-4 ring-background transition-shadow duration-200 group-hover:shadow-md",
											actionColors.bg,
											actionColors.border,
											actionColors.text,
											actionColors.glow,
										)}
									>
										<IconComponent className="h-4 w-4" />
									</div>

									{/* Content */}
									<div className="flex-1 min-w-0">
										<div className="flex items-center gap-2 flex-wrap">
											<span className="font-semibold text-sm">
												{formatAction(log.action)}
											</span>
											<Badge
												variant="outline"
												className={cn(
													"text-[10px] px-1.5 py-0 h-5 font-medium border inline-flex items-center gap-1 shrink-0",
													severityConfig.solid ?? severityConfig.color,
												)}
											>
												<severityConfig.icon className="h-3 w-3 shrink-0" aria-hidden="true" />
												{severityConfig.label}
											</Badge>
											{log.status === "failure" && (
												<Badge
													variant="destructive"
													className="text-[10px] px-1.5 py-0 h-5 font-medium inline-flex items-center shrink-0"
												>
													Failed
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground mt-0.5 line-clamp-2 leading-snug">
											{description}
										</p>
									</div>

									{/* Right side info */}
									<div className="text-right shrink-0 flex flex-col items-end gap-0.5">
										<span className="text-xs font-medium text-foreground/80 tabular-nums">
											{timeInfo.relative}
										</span>
										<span className="text-[11px] text-muted-foreground flex items-center gap-1 max-w-[120px]">
											<User className="h-3 w-3 shrink-0" />
											<span className="truncate">{log.userEmail?.split("@")[0] || "system"}</span>
										</span>
									</div>

									{/* Chevron hint */}
									<ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-[color,translate] duration-200 shrink-0" />
								</div>
							);
						})}

						{hasMore ? (
							<div className="border-t p-3 text-center bg-muted/20 flex flex-col items-center gap-2">
								<p className="text-xs text-muted-foreground">
									Showing {visibleLogs.length} of {logs.length} entries
								</p>
								<Button
									variant="outline"
									size="sm"
									onClick={() => setDisplayLimit((prev) => prev + PAGE_SIZE)}
									className="gap-1.5 h-8 text-xs font-medium active:scale-[0.98]"
								>
									<ChevronDown className="h-3.5 w-3.5" />
									Load More ({Math.min(PAGE_SIZE, logs.length - visibleLogs.length)} more)
								</Button>
							</div>
						) : logs.length > PAGE_SIZE ? (
							<p className="border-t px-4 py-2.5 text-center text-xs text-muted-foreground bg-muted/10">
								All {logs.length} entries loaded
							</p>
						) : null}
					</div>
				) : (
					<div className="text-center py-20 px-4">
						{/* Non-interactive decoration: no hover tilt/scale. */}
						<div className="h-20 w-20 mx-auto mb-5 rounded-2xl bg-muted/60 flex items-center justify-center">
							<ScrollText className="h-9 w-9 text-muted-foreground/60" />
						</div>
						<h3 className="font-semibold text-lg">No activity logs found</h3>
						<p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
							{logs.length === 0
								? "No activity has been recorded yet. Create a transaction or sign in to see audit events appear here in real-time."
								: "No logs match your current filters. Try adjusting your search criteria or clearing filters."}
						</p>
						{logs.length === 0 ? (
							<Button className="mt-5" asChild>
								<Link to="/transactions">
									<Plus className="h-4 w-4 mr-2" />
									Create Transaction
								</Link>
							</Button>
						) : (
							<Button
								variant="outline"
								className="mt-5"
								onClick={onClearFilters}
							>
								<X className="h-4 w-4 mr-2" />
								Clear All Filters
							</Button>
						)}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
