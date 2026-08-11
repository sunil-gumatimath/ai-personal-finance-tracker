import type { LogEntry } from "@/types/api";
import {
	formatAction,
	formatMetadata,
	formatResource,
	formatTimestamp,
	generateHumanDescription,
	getFieldChanges,
} from "./log-formatter";

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
): LogExport {
	const baseName = `activity-logs-${new Date().toISOString().slice(0, 10)}`;

	if (format === "json") {
		const enhancedLogs = logs.map((log) => ({
			...log,
			humanReadable: {
				action: formatAction(log.action),
				resource: formatResource(log.resource).short,
				timestamp: formatTimestamp(log.timestamp),
				description: generateHumanDescription(log),
				fieldChanges: getFieldChanges(log.oldValue, log.newValue),
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
		const changes = getFieldChanges(log.oldValue, log.newValue)
			.map((change) => change.summary)
			.join("; ");
		return [
			formatTimestamp(log.timestamp).absolute,
			formatAction(log.action),
			log.userEmail || "system",
			generateHumanDescription(log),
			formatResource(log.resource).short,
			log.severity,
			log.status,
			changes || "N/A",
		];
	});
	const content = [
		headers.join(","),
		...rows.map((row) => row.map((value) => `"${value}"`).join(",")),
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
