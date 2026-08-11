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
import {
	formatAction,
	formatTimestamp,
	generateHumanDescription,
} from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";
import {
	getActionColor,
	getActionIconComponent,
	getSeverityConfig,
} from "./log-visuals";

interface LogTimelineProps {
	logs: LogEntry[];
	loading: boolean;
	onSelectLog: (log: LogEntry) => void;
	onClearFilters: () => void;
}

/** Activity timeline card: loading skeleton, live rows, and empty states. */
export function LogTimeline({
	logs,
	loading,
	onSelectLog,
	onClearFilters,
}: LogTimelineProps) {
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
								className="flex items-center gap-4 p-4 animate-pulse"
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
				) : logs.length > 0 ? (
					<div className="relative">
						{/* Vertical timeline line */}
						<div className="absolute left-[36px] top-0 bottom-0 w-px bg-border/50 hidden sm:block" />

						{logs.map((log, index) => {
							const timeInfo = formatTimestamp(log.timestamp);
							const description = generateHumanDescription(log);
							const actionColors = getActionColor(log.action);
							const severityConfig = getSeverityConfig(log.severity);
							const IconComponent = getActionIconComponent(log.action);

							return (
								<div
									key={log.id}
									onClick={() => onSelectLog(log)}
									className="group relative flex items-center gap-4 px-4 py-3.5 cursor-pointer transition-all duration-200 hover:bg-muted/40 active:bg-muted/60"
									style={{
										animationDelay: `${Math.min(index * 30, 300)}ms`,
									}}
								>
									{/* Icon node */}
									<div
										className={`relative z-10 flex items-center justify-center h-10 w-10 rounded-full border shrink-0 transition-shadow duration-200 group-hover:shadow-md ${actionColors.bg} ${actionColors.border} ${actionColors.text} group-hover:${actionColors.glow}`}
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
												className={`text-[10px] px-1.5 py-0 h-5 font-medium border ${severityConfig.color}`}
											>
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
									<ChevronRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-muted-foreground transition-all duration-200 group-hover:translate-x-0.5 shrink-0" />
								</div>
							);
						})}
					</div>
				) : (
					<div className="text-center py-20 px-4">
						<div className="h-20 w-20 mx-auto mb-5 rounded-2xl bg-muted/60 flex items-center justify-center rotate-3 transition-transform hover:rotate-0 hover:scale-105 duration-300">
							<ScrollText className="h-9 w-9 text-muted-foreground/60" />
						</div>
						<h3 className="font-semibold text-lg">No activity logs found</h3>
						<p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto leading-relaxed">
							{logs.length === 0
								? "No transaction activity has been recorded yet. Create or edit a transaction to see logs appear here in real-time."
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
