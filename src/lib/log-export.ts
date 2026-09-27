import type { LogEntry } from "@/types/api";
import {
	formatAction,
	formatMetadata,
	formatResource,
	formatTimestamp,
	generateHumanDescription,
	getFieldChanges,
	type FormatOptions,
} from "./log-formatter";
import { escapeCsvField } from "./csv";

export interface LogExport {
	content: string;
	filename: string;
}

/**
 * Serializes logs into JSON (with human-readable enrichment) or CSV.
 * Pure — no DOM or side effects, so it stays testable.
 */
export function buildLogExport(
	logs: LogEntry[],
	format: "json" | "csv",
	opts?: FormatOptions,
): LogExport {
	// LOCAL date, not `toISOString()` — the export is named for the user's day,
	// and UTC reports yesterday for anyone east of Greenwich (the default
	// currency here is INR, UTC+5:30).
	const now = new Date();
	const baseName = `activity-logs-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

	if (format === "json") {
		const enhancedLogs = logs.map((log) => ({
			...log,
			humanReadable: {
				action: formatAction(log.action),
				resource: formatResource(log.resource).short,
				timestamp: formatTimestamp(log.timestamp, opts),
				description: generateHumanDescription(log, opts),
				fieldChanges: getFieldChanges(log.oldValue, log.newValue, opts),
				metadata: formatMetadata(log.metadata),
			},
		}));
		return {
			content: JSON.stringify(enhancedLogs, null, 2),
			filename: `${baseName}.json`,
		};
	}

	const headers = [
		"Timestamp",
		"Action",
		"User",
		"Description",
		"Resource",
		"Severity",
		"Status",
		"Changes",
	];
	const rows = logs.map((log) => {
		const changes = getFieldChanges(log.oldValue, log.newValue, opts)
			.map((change) => change.summary)
			.join("; ");
		return [
			formatTimestamp(log.timestamp, opts).absolute,
			formatAction(log.action),
			log.userEmail || "system",
			generateHumanDescription(log, opts),
			formatResource(log.resource).short,
			log.severity,
			log.status,
			changes || "N/A",
		];
	});
	const content = [
		headers.join(","),
		...rows.map((row) => row.map((value) => escapeCsvField(value)).join(",")),
	].join("\n");
	return { content, filename: `${baseName}.csv` };
}

/** Triggers a browser download for the given text payload. */
export function downloadLogFile(content: string, filename: string): void {
	const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	link.click();
	URL.revokeObjectURL(url);
}
