import { createPortal } from "react-dom";
import {
	Activity,
	ArrowUpDown,
	CheckCircle2,
	Clock,
	FileText,
	Info,
	Shield,
	User,
	X,
	XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	formatAction,
	formatFieldName,
	formatFieldValue,
	formatMetadata,
	formatResource,
	formatTimestamp,
	getFieldChanges,
	shouldShowField,
} from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";
import {
	getActionColor,
	getActionIconComponent,
	getSeverityConfig,
} from "./log-visuals";

interface LogDetailDrawerProps {
	log: LogEntry | null;
	visible: boolean;
	onClose: () => void;
}

/**
 * Slide-in detail drawer for a single log entry. Portaled to document.body
 * to escape overflow-auto clipping.
 */
export function LogDetailDrawer({
	log,
	visible,
	onClose,
}: LogDetailDrawerProps) {
	if (!log) return null;

	return createPortal(
		<div
			className={`fixed inset-0 z-[100] transition-all duration-300 ${
				visible
					? "bg-black/40 backdrop-blur-sm"
					: "bg-transparent pointer-events-none"
			}`}
			onClick={onClose}
		>
			<div
				className={`pointer-events-auto absolute right-0 top-0 w-full max-w-2xl h-full bg-card border-l shadow-2xl flex flex-col transition-transform duration-300 ease-out ${
					visible ? "translate-x-0" : "translate-x-full"
				}`}
				onClick={(e) => e.stopPropagation()}
			>
				{/* Drawer Header */}
				<div className="flex items-center justify-between p-6 border-b bg-muted/30">
					<div className="flex items-center gap-3">
						{(() => {
							const actionColors = getActionColor(log.action);
							const IconComp = getActionIconComponent(log.action);
							return (
								<div
									className={`flex items-center justify-center h-12 w-12 rounded-xl border ${actionColors.bg} ${actionColors.border} ${actionColors.text}`}
								>
									<IconComp className="h-5 w-5" />
								</div>
							);
						})()}
						<div>
							<h2 className="text-lg font-semibold">
								{formatAction(log.action)}
							</h2>
							<p className="text-xs text-muted-foreground mt-0.5">
								{formatTimestamp(log.timestamp).absolute}
							</p>
						</div>
					</div>
					<Button
						variant="ghost"
						size="icon"
						onClick={onClose}
						className="h-8 w-8 rounded-lg"
					>
						<X className="h-4 w-4" />
					</Button>
				</div>

				{/* Drawer Content */}
				<div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
					{/* Summary Card */}
					<div className="space-y-3">
						<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
							Event Details
						</h3>
						<Card>
							<CardContent className="p-0 divide-y">
								<div className="flex items-center justify-between p-4">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<User className="h-3.5 w-3.5" />
										User
									</span>
									<span className="text-sm font-medium">
										{log.userEmail || "System"}
									</span>
								</div>
								<div className="flex items-center justify-between p-4">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Shield className="h-3.5 w-3.5" />
										Status
									</span>
									<div className="flex items-center gap-1.5">
										{log.status === "success" ? (
											<CheckCircle2 className="h-4 w-4 text-emerald-500" />
										) : (
											<XCircle className="h-4 w-4 text-rose-500" />
										)}
										<span className="text-sm font-medium capitalize">
											{log.status}
										</span>
									</div>
								</div>
								<div className="flex items-center justify-between p-4">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Activity className="h-3.5 w-3.5" />
										Severity
									</span>
									{(() => {
										const config = getSeverityConfig(log.severity);
										return (
											<Badge
												variant="outline"
												className={`text-xs font-medium border ${config.color}`}
											>
												{config.label}
											</Badge>
										);
									})()}
								</div>
								<div className="flex items-center justify-between p-4">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<FileText className="h-3.5 w-3.5" />
										Resource
									</span>
									<span className="text-sm font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
										{formatResource(log.resource).short}
									</span>
								</div>
								<div className="flex items-center justify-between p-4">
									<span className="text-sm text-muted-foreground flex items-center gap-2">
										<Clock className="h-3.5 w-3.5" />
										Time
									</span>
									<span className="text-sm font-medium">
										{formatTimestamp(log.timestamp).relative}
									</span>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Changes */}
					{(log.oldValue !== null || log.newValue !== null) && (
						<div className="space-y-3">
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
								<ArrowUpDown className="h-3.5 w-3.5" />
								Changes
							</h3>
							<Card>
								<CardContent className="p-0 divide-y">
									{(() => {
										const fieldChanges = getFieldChanges(
											log.oldValue,
											log.newValue,
										);

										if (fieldChanges.length === 0) {
											const isDeletion = log.oldValue && !log.newValue;
											const isCreation = !log.oldValue && log.newValue;

											if (isDeletion && log.oldValue) {
												const oldObj = JSON.parse(log.oldValue);
												return Object.entries(oldObj)
													.filter(([key]) => shouldShowField(key))
													.map(([key, value]) => (
														<div
															key={key}
															className="flex items-center justify-between p-4 text-sm"
														>
															<span className="text-muted-foreground">
																{formatFieldName(key)}
															</span>
															<span className="font-mono text-sm bg-rose-500/8 text-rose-600 px-2 py-0.5 rounded line-through decoration-rose-400/50">
																{formatFieldValue(key, value)}
															</span>
														</div>
													));
											}

											if (isCreation && log.newValue) {
												const newObj = JSON.parse(log.newValue);
												return Object.entries(newObj)
													.filter(([key]) => shouldShowField(key))
													.map(([key, value]) => (
														<div
															key={key}
															className="flex items-center justify-between p-4 text-sm"
														>
															<span className="text-muted-foreground">
																{formatFieldName(key)}
															</span>
															<span className="font-mono text-sm bg-emerald-500/8 text-emerald-600 px-2 py-0.5 rounded">
																{formatFieldValue(key, value)}
															</span>
														</div>
													));
											}

											return (
												<div className="p-5 text-sm text-muted-foreground text-center">
													No field-level changes detected
												</div>
											);
										}

										return fieldChanges.map((change, i) => (
											<div key={i} className="p-4 space-y-2.5">
												<span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
													{formatFieldName(change.field)}
												</span>
												<div className="grid grid-cols-2 gap-3 text-sm">
													<div className="px-3 py-2 rounded-lg bg-rose-500/8 border border-rose-500/15 font-mono text-rose-600 break-words">
														<span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500/70 block mb-1">
															Before
														</span>
														{formatFieldValue(change.field, change.oldValue)}
													</div>
													<div className="px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 font-mono text-emerald-600 break-words">
														<span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70 block mb-1">
															After
														</span>
														{formatFieldValue(change.field, change.newValue)}
													</div>
												</div>
											</div>
										));
									})()}
								</CardContent>
							</Card>
						</div>
					)}

					{/* Metadata */}
					{Object.keys(log.metadata).length > 0 && (
						<div className="space-y-3">
							<h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
								<Info className="h-3.5 w-3.5" />
								Metadata
							</h3>
							<Card>
								<CardContent className="p-0 divide-y">
									{formatMetadata(log.metadata).map((item, i) => (
										<div
											key={i}
											className="flex items-center justify-between p-4 text-sm"
										>
											<span className="text-muted-foreground">
												{item.label}
											</span>
											<span className="font-mono text-sm bg-muted/50 px-2 py-0.5 rounded">
												{item.value}
											</span>
										</div>
									))}
								</CardContent>
							</Card>
						</div>
					)}
				</div>

				{/* Drawer Footer */}
				<div className="p-4 border-t bg-muted/20">
					<Button onClick={onClose} variant="outline" className="w-full">
						Close
					</Button>
				</div>
			</div>
		</div>,
		document.body,
	);
}
