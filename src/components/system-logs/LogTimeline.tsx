import { ChevronRight, Plus, ScrollText, User, X } from "lucide-react";
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

/** Upper bound on rendered rows so an unbounded live feed can't grow forever. */
const MAX_RENDERED_ROWS = 200;

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
	const visibleLogs = logs.slice(0, MAX_RENDERED_ROWS);

	return (
		<Card className="overflow-hidden">
			<CardHeader className="border-b bg-muted/30">
				<div className="flex items-center justify-between">
					<div>
						<CardTitle className="text-base font-semibold">
							Activity Timeline
						</CardTitle>
						<CardDescription className="mt-0.5">
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
								style={{ animationDelay: `${i * 100}ms` }}
							>
								<div className="h-10 w-10 rounded-full bg-muted shrink-0" />
								<div className="flex-1 space-y-2.5">
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
						{/* Vertical timeline line */}
						<div className="absolute left-[36px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />

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
										"group relative flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-colors duration-200 hover:bg-muted/40 active:bg-muted/60 focus-visible:bg-muted/40 focus-visible:outline-none",
										// Staggered entrance; delays capped at 300ms.
										"motion-safe:animate-fade-in-up",
									)}
									style={{
										animationDelay: `${Math.min(index * 30, 300)}ms`,
										animationFillMode: "both",
									}}
								>
									{/* Icon node */}
									<div
										className={`relative z-10 flex items-center justify-center h-10 w-10 rounded-full border shrink-0 transition-shadow duration-200 group-hover:shadow-md ${actionColors.bg} ${actionColors.border} ${actionColors.text} ${actionColors.glow}`}
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
													"text-[10px] px-1.5 py-0 h-5 font-medium border",
													severityConfig.solid ?? severityConfig.color,
												)}
											>
												<severityConfig.icon aria-hidden="true" />
												{severityConfig.label}
											</Badge>
											{log.status === "failure" && (
												<Badge
													variant="destructive"
													className="text-[10px] px-1.5 py-0 h-5"
												>
													Failed
												</Badge>
											)}
										</div>
										<p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
											{description}
										</p>
									</div>

									{/* Right side info */}
									<div className="text-right shrink-0 flex flex-col items-end gap-0.5">
										<span className="text-xs font-medium text-foreground/80">
											{timeInfo.relative}
										</span>
										<span className="text-[11px] text-muted-foreground flex items-center gap-1">
											<User className="h-3 w-3" />
											{log.userEmail?.split("@")[0] || "system"}
										</span>
									</div>

									{/* Chevron hint */}
									<ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground group-hover:translate-x-0.5 transition-[color,translate] duration-200 shrink-0" />
								</div>
							);
						})}

						{logs.length > MAX_RENDERED_ROWS && (
							<p className="border-t px-4 py-2.5 text-center text-xs text-muted-foreground">
								Showing latest {MAX_RENDERED_ROWS} of {logs.length} entries
								— refine your filters or export to see more.
							</p>
						)}
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
