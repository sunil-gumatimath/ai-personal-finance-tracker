import { useCallback, useMemo, useState } from "react";
import {
	Calendar,
	ChevronDown,
	Download,
	FileEdit,
	FileText,
	Filter,
	Plus,
	RefreshCw,
	ScrollText,
	Search,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { currencyLocales } from "@/types/preferences";
import { usePreferences } from "@/hooks/usePreferences";
import { LogDetailDrawer } from "@/components/system-logs/LogDetailDrawer";
import { LogTimeline } from "@/components/system-logs/LogTimeline";
import { useSystemLogs } from "@/hooks/useSystemLogs";
import { buildLogExport, downloadLogFile } from "@/lib/log-export";
import { formatAction, generateHumanDescription, type FormatOptions } from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";

export type { LogEntry } from "@/types/api";

const STAT_CARDS = [
	{
		label: "Total Events",
		key: "total",
		icon: ScrollText,
		color: "text-foreground",
		accent: "from-violet-500/10 to-indigo-500/10",
		iconColor: "text-violet-500",
	},
	{
		label: "Txns Created",
		key: "created",
		icon: Plus,
		color: "text-emerald-600",
		accent: "from-emerald-500/10 to-green-500/10",
		iconColor: "text-emerald-500",
	},
	{
		label: "Txns Edited",
		key: "edited",
		icon: FileEdit,
		color: "text-blue-600",
		accent: "from-blue-500/10 to-cyan-500/10",
		iconColor: "text-blue-500",
	},
	{
		label: "Txns Deleted",
		key: "deleted",
		icon: Trash2,
		color: "text-rose-600",
		accent: "from-rose-500/10 to-pink-500/10",
		iconColor: "text-rose-500",
	},
	{
		label: "Today",
		key: "today",
		icon: Zap,
		color: "text-amber-600",
		accent: "from-amber-500/10 to-orange-500/10",
		iconColor: "text-amber-500",
	},
	{
		label: "This Week",
		key: "thisWeek",
		icon: Calendar,
		color: "text-sky-600",
		accent: "from-sky-500/10 to-blue-500/10",
		iconColor: "text-sky-500",
	},
] as const;

export function SystemLogs() {
	const { logs, loading, stats, wsStatus, error, refresh } = useSystemLogs();
	const { preferences } = usePreferences();

	const [searchQuery, setSearchQuery] = useState("");
	const [selectedSeverity, setSelectedSeverity] = useState("all");
	const [selectedAction, setSelectedAction] = useState("all");
	const [dateRange, setDateRange] = useState("all");

	const [inspectedLog, setInspectedLog] = useState<LogEntry | null>(null);
	const [isRefreshing, setIsRefreshing] = useState(false);

	// User's currency/locale threaded into every log formatter call.
	const formatOptions = useMemo<FormatOptions>(
		() => ({
			currency: preferences.currency,
			locale: currencyLocales[preferences.currency] || "en-US",
		}),
		[preferences.currency],
	);

	const openDrawer = useCallback((log: LogEntry) => {
		setInspectedLog(log);
	}, []);

	const closeDrawer = useCallback(() => {
		setInspectedLog(null);
	}, []);

	/** One accurate toast per refresh; button spins + disables while pending. */
	const handleRefresh = async () => {
		if (isRefreshing) return;
		setIsRefreshing(true);
		try {
			const ok = await refresh();
			if (ok) {
				toast.success("Logs refreshed");
			} else {
				toast.error("Couldn't refresh logs");
			}
		} finally {
			setIsRefreshing(false);
		}
	};

	const clearFilters = () => {
		setSearchQuery("");
		setSelectedSeverity("all");
		setSelectedAction("all");
		setDateRange("all");
	};

	const hasActiveFilters =
		searchQuery ||
		selectedAction !== "all" ||
		selectedSeverity !== "all" ||
		dateRange !== "all";

	const filteredLogs = useMemo(() => {
		const now = new Date();
		const todayStart = new Date(
			now.getFullYear(),
			now.getMonth(),
			now.getDate(),
		);
		const weekStart = new Date(todayStart);
		weekStart.setDate(weekStart.getDate() - 7);
		const monthStart = new Date(todayStart);
		monthStart.setDate(monthStart.getDate() - 30);

		return logs.filter((log) => {
			const matchesSearch =
				searchQuery === "" ||
				log.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
				log.resource.toLowerCase().includes(searchQuery.toLowerCase()) ||
				(log.userEmail || "")
					.toLowerCase()
					.includes(searchQuery.toLowerCase()) ||
				generateHumanDescription(log, formatOptions)
					.toLowerCase()
					.includes(searchQuery.toLowerCase());

			const matchesSeverity =
				selectedSeverity === "all" || log.severity === selectedSeverity;
			const matchesAction =
				selectedAction === "all" || log.action === selectedAction;

			let matchesDate = true;
			if (dateRange === "today") {
				matchesDate = new Date(log.timestamp) >= todayStart;
			} else if (dateRange === "week") {
				matchesDate = new Date(log.timestamp) >= weekStart;
			} else if (dateRange === "month") {
				matchesDate = new Date(log.timestamp) >= monthStart;
			}

			return matchesSearch && matchesSeverity && matchesAction && matchesDate;
		});
	}, [logs, searchQuery, selectedSeverity, selectedAction, dateRange, formatOptions]);

	const actionOptions = useMemo(() => {
		const set = new Set<string>();
		logs.forEach((log) => set.add(log.action));
		return Array.from(set);
	}, [logs]);

	const exportLogs = (format: "json" | "csv") => {
		// Export what the user currently sees (filtered), not the raw fetch.
		const { content, filename } = buildLogExport(filteredLogs, format);
		downloadLogFile(content, filename);
		toast.success(
			filteredLogs.length === logs.length
				? `Exported ${format.toUpperCase()} successfully!`
				: `Exported ${filteredLogs.length} filtered entries as ${format.toUpperCase()}!`,
		);
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
				<div>
					<div className="flex items-center gap-3">
						<h1 className="text-2xl sm:text-3xl font-bold tracking-tight">
							Activity Logs
						</h1>
						<div
							className={`flex items-center gap-2 px-3 py-1.5 rounded-full border transition-colors duration-200 ${
								wsStatus === "connected"
									? "bg-emerald-500/10 border-emerald-500/25 text-emerald-600"
									: wsStatus === "reconnecting"
										? "bg-amber-500/10 border-amber-500/25 text-amber-600"
										: "bg-rose-500/10 border-rose-500/25 text-rose-600"
							}`}
						>
							<span className="relative flex h-2 w-2">
								{wsStatus === "connected" && (
									<span className="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
								)}
								<span
									className={`relative inline-flex rounded-full h-2 w-2 ${
										wsStatus === "connected"
											? "bg-emerald-500"
											: wsStatus === "reconnecting"
												? "bg-amber-500 motion-safe:animate-pulse"
												: "bg-rose-500"
									}`}
								></span>
							</span>
							<span className="text-xs font-semibold uppercase tracking-wider">
								{wsStatus === "connected"
									? "Live"
									: wsStatus === "reconnecting"
										? "Reconnecting"
										: "Offline"}
							</span>
						</div>
					</div>
					<p className="text-sm text-muted-foreground mt-1.5">
						Track and audit every change across your finances — transactions,
						accounts, sign-ins, recurring runs, and system errors.
					</p>
				</div>

				<div className="flex items-center gap-2">
					<Button
						variant="outline"
						size="sm"
						onClick={handleRefresh}
						disabled={isRefreshing}
						className="gap-1.5 h-9 cursor-pointer"
					>
						<RefreshCw
							className={cn(
								"h-3.5 w-3.5",
								isRefreshing && "motion-safe:animate-spin",
							)}
						/>
						Refresh
					</Button>
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button variant="outline" size="sm" className="gap-1.5 h-9">
								<Download className="h-3.5 w-3.5" />
								Export
								<ChevronDown className="h-3 w-3 opacity-50" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end">
							<DropdownMenuItem onClick={() => exportLogs("json")}>
								<FileText className="h-4 w-4 mr-2" />
								Export as JSON
							</DropdownMenuItem>
							<DropdownMenuItem onClick={() => exportLogs("csv")}>
								<Download className="h-4 w-4 mr-2" />
								Export as CSV
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			{/* Stats Grid */}
			<div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
				{STAT_CARDS.map((stat) => (
					<Card
						key={stat.key}
						className="group relative overflow-hidden py-0 gap-0 transition-[box-shadow,translate] duration-300 ease-out hover:shadow-md hover:-translate-y-0.5"
					>
						<div
							className={`absolute inset-0 bg-gradient-to-br ${stat.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-300`}
						/>
						<CardContent className="p-4 relative">
							<div className="flex items-center justify-between">
								<div>
									<p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
										{stat.label}
									</p>
									<p
										className={`text-2xl font-bold mt-1 tabular-nums ${stat.color}`}
									>
										{stats[stat.key]}
									</p>
								</div>
								<div
									className={`h-9 w-9 rounded-xl flex items-center justify-center ${stat.iconColor} bg-muted/50 group-hover:bg-background/60 transition-colors duration-300`}
								>
									<stat.icon className="h-4 w-4" />
								</div>
							</div>
						</CardContent>
					</Card>
				))}
			</div>

			{/* Filters */}
			<Card className="py-0 gap-0">
				<CardContent className="p-4">
					<div className="flex flex-col sm:flex-row gap-3">
						<div className="relative flex-1">
							<Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
							<Input
								placeholder="Search by action, description, or user..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="pl-9 h-10"
								aria-label="Search activity logs"
							/>
						</div>
						<Select value={selectedAction} onValueChange={setSelectedAction}>
							<SelectTrigger
								aria-label="Filter by action"
								className="w-full sm:w-[180px] h-10 cursor-pointer"
							>
								<SelectValue placeholder="All Actions" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Actions</SelectItem>
								{actionOptions.map((action) => (
									<SelectItem key={action} value={action}>
										{formatAction(action)}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={selectedSeverity}
							onValueChange={setSelectedSeverity}
						>
							<SelectTrigger
								aria-label="Filter by severity"
								className="w-full sm:w-[160px] h-10 cursor-pointer"
							>
								<SelectValue placeholder="All Severities" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Severities</SelectItem>
								<SelectItem value="info">Info</SelectItem>
								<SelectItem value="warning">Warning</SelectItem>
								<SelectItem value="error">Error</SelectItem>
								<SelectItem value="critical">Critical</SelectItem>
							</SelectContent>
						</Select>
						<Select value={dateRange} onValueChange={setDateRange}>
							<SelectTrigger
								aria-label="Filter by date range"
								className="w-full sm:w-[160px] h-10 cursor-pointer"
							>
								<SelectValue placeholder="All Time" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="all">All Time</SelectItem>
								<SelectItem value="today">Today</SelectItem>
								<SelectItem value="week">Last 7 Days</SelectItem>
								<SelectItem value="month">Last 30 Days</SelectItem>
							</SelectContent>
						</Select>
						{hasActiveFilters && (
							<Button
								variant="ghost"
								size="sm"
								onClick={clearFilters}
								className="h-10 shrink-0 text-muted-foreground hover:text-foreground"
							>
								<X className="h-4 w-4 mr-1.5" />
								Clear
							</Button>
						)}
					</div>
					{hasActiveFilters && (
						<div className="flex items-center gap-2 mt-3 pt-3 border-t">
							<Filter className="h-3.5 w-3.5 text-muted-foreground" />
							<span className="text-xs text-muted-foreground">
								Showing {filteredLogs.length} of {logs.length} entries
							</span>
						</div>
					)}
				</CardContent>
			</Card>

			{/* Activity Timeline */}
			<LogTimeline
				logs={filteredLogs}
				loading={loading}
				onSelectLog={openDrawer}
				onClearFilters={clearFilters}
				error={error}
				onRetry={() => void refresh()}
				formatOptions={formatOptions}
			/>

			{/* Detail Drawer — Radix Sheet (portal, focus trap, Escape, scroll lock) */}
			<LogDetailDrawer
				log={inspectedLog}
				open={inspectedLog !== null}
				onClose={closeDrawer}
				formatOptions={formatOptions}
			/>
		</div>
	);
}
