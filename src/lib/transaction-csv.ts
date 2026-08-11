import { format } from "date-fns";
import type { Transaction } from "@/types";

/** RFC 4180 field escaping: quote when needed, double internal quotes. */
function escapeCSVField(field: string | number | null | undefined): string {
	if (field === null || field === undefined) return "";
	const str = String(field);
	if (
		str.includes(",") ||
		str.includes("\n") ||
		str.includes("\r") ||
		str.includes('"')
	) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/** Serializes transactions to CSV (with BOM for Excel UTF-8 compatibility). */
export function buildTransactionsCsv(transactions: Transaction[]): string {
	const headers = [
		"Type",
		"Description",
		"Category",
		"Account",
		"Date",
		"Amount",
	];
	const csvRows = [
		headers.join(","),
		...transactions.map((t) =>
			[
				escapeCSVField(t.type),
				escapeCSVField(t.description),
				escapeCSVField(t.category?.name),
				escapeCSVField(t.account?.name),
				escapeCSVField(t.date),
				escapeCSVField(t.amount),
			].join(","),
		),
	];

	const BOM = "\uFEFF";
	return BOM + csvRows.join("\r\n");
}

/** Triggers a browser download of the CSV export. */
export function downloadTransactionsCsv(transactions: Transaction[]): void {
	const content = buildTransactionsCsv(transactions);
	const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
	const link = document.createElement("a");
	if (link.download === undefined) return;
	const url = URL.createObjectURL(blob);
	link.setAttribute("href", url);
	link.setAttribute(
		"download",
		`transactions_${format(new Date(), "yyyy-MM-dd")}.csv`,
	);
	link.style.visibility = "hidden";
	document.body.append(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}
