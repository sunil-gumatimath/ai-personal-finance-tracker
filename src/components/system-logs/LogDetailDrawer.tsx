import { useState } from "react";
import {
	Activity,
	ArrowUpDown,
	Check,
	CheckCircle2,
	Clock,
	Copy,
	FileText,
	Info,
	Shield,
	User,
	XCircle,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetTitle,
} from "@/components/ui/sheet";
import {
	formatAction,
	formatFieldName,
	formatFieldValue,
	formatMetadata,
	formatResource,
	formatTimestamp,
	getFieldChanges,
	safeJsonParse,
	shouldShowField,
	type FormatOptions,
} from "@/lib/log-formatter";
import type { LogEntry } from "@/types/api";
import {
	getActionColor,
	getActionIconComponent,
	getSeverityConfig,
} from "./log-visuals";

interface LogDetailDrawerProps {
	log: LogEntry | null;
	open: boolean;
	onClose: () => void;
	/** Currency/locale threaded from user preferences. */
	formatOptions?: FormatOptions;
}

/** Icon-only ghost button that copies a value and flashes a check on success. */
function CopyButton({ value, label }: { value: string; label: string }) {
	const [copied, setCopied] = useState(false);

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
			window.setTimeout(() => setCopied(false), 1500);
		} catch {
			// Clipboard unavailable (permissions/insecure context) — no-op.
		}
	};

	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="h-6 w-6 shrink-0"
			onClick={handleCopy}
			aria-label={`Copy ${label}`}
		>
			{copied ? (
				<Check className="h-3 w-3 text-emerald-500" aria-hidden="true" />
			) : (
				<Copy className="h-3 w-3 text-muted-foreground" aria-hidden="true" />
			)}
		</Button>
	);
}

/**
 * Slide-in detail drawer for a single log entry, built on the Radix-backed
 * Sheet primitive (focus trap, Escape, scroll lock, return focus).
 */
export function LogDetailDrawer({
	log,
	open,
	onClose,
	formatOptions,
}: LogDetailDrawerProps) {
	return (
		<Sheet
			open={open && log !== null}
			onOpenChange={(nextOpen) => {
				if (!nextOpen) onClose();
			}}
		>
			<SheetContent
				side="right"
				className="w-full max-w-2xl gap-0 border-l bg-card p-0 sm:max-w-2xl"
			>
				{log && (
					<>
						{/* Drawer Header */}
						<div className="flex items-center gap-3 p-6 pr-14 border-b bg-muted/30">
							{(() => {
								const actionColors = getActionColor(log.action);
								const IconComp = getActionIconComponent(log.action);
								return (
									<div
										className={`flex items-center justify-center h-12 w-12 rounded-xl border shrink-0 ${actionColors.bg} ${actionColors.border} ${actionColors.text}`}
									>
										<IconComp className="h-5 w-5" />
									</div>
								);
							})()}
							<div className="min-w-0">
								<SheetTitle className="text-lg font-semibold truncate">
									{formatAction(log.action)}
								</SheetTitle>
								<SheetDescription className="text-xs mt-0.5">
									{formatTimestamp(log.timestamp).absolute}
								</SheetDescription>
							</div>
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
														className={`text-xs font-medium border gap-1 ${config.solid ?? config.color}`}
													>
														<config.icon aria-hidden="true" />
														{config.label}
													</Badge>
												);
											})()}
										</div>
										<div className="flex items-center justify-between gap-2 p-4">
											<span className="text-sm text-muted-foreground flex items-center gap-2 shrink-0">
												<FileText className="h-3.5 w-3.5" />
												Resource
											</span>
											<span className="flex items-center gap-1 min-w-0">
												<span className="font-mono text-xs sm:text-sm text-muted-foreground bg-muted/50 px-2 py-0.5 rounded truncate">
													{formatResource(log.resource).short}
												</span>
												<CopyButton
													value={log.resource}
													label="resource ID"
												/>
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
													formatOptions,
												);

												if (fieldChanges.length === 0) {
													const isDeletion = log.oldValue && !log.newValue;
													const isCreation = !log.oldValue && log.newValue;

													if (isDeletion && log.oldValue) {
														const oldObj =
															safeJsonParse<Record<string, unknown>>(
																log.oldValue,
															) ?? {};
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
																		{formatFieldValue(key, value, formatOptions)}
																	</span>
																</div>
															));
													}

													if (isCreation && log.newValue) {
														const newObj =
															safeJsonParse<Record<string, unknown>>(
																log.newValue,
															) ?? {};
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
																		{formatFieldValue(key, value, formatOptions)}
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
																{formatFieldValue(
																	change.field,
																	change.oldValue,
																	formatOptions,
																)}
															</div>
															<div className="px-3 py-2 rounded-lg bg-emerald-500/8 border border-emerald-500/15 font-mono text-emerald-600 break-words">
																<span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500/70 block mb-1">
																	After
																</span>
																{formatFieldValue(
																	change.field,
																	change.newValue,
																	formatOptions,
																)}
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
											{formatMetadata(log.metadata, formatOptions).map(
												(item, i) => (
													<div
														key={i}
														className="flex items-center justify-between gap-2 p-4 text-sm"
													>
														<span className="text-muted-foreground">
															{item.label}
														</span>
														<span className="flex items-center gap-1 min-w-0">
															<span className="font-mono text-xs sm:text-sm bg-muted/50 px-2 py-0.5 rounded break-all">
																{item.value}
															</span>
															<CopyButton
																value={item.value}
																label={item.label.toLowerCase()}
															/>
														</span>
													</div>
												),
											)}
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
					</>
				)}
			</SheetContent>
		</Sheet>
	);
}
