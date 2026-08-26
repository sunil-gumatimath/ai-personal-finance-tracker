import { format } from "date-fns";
import { toast } from "sonner";
import type { Transaction } from "@/types";
import { escapeCsvField as escapeCSVField } from "./csv";

/** Serializes transactions to CSV (with BOM for Excel UTF-8 compatibility). */
function buildTransactionsCsv(transactions: Transaction[]): string {
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

/**
 * Filename reflects the exported range:
 * transactions_YYYY-MM-DD_to_YYYY-MM-DD.csv — falling back to today when the
 * selection carries no usable dates.
 */
function buildCsvFilename(transactions: Transaction[]): string {
	const today = format(new Date(), "yyyy-MM-dd");
	const dates = transactions
		.map((t) => t.date)
		.filter((d) => typeof d === "string" && d.length >= 10)
		.sort();
	const first = dates[0]?.slice(0, 10);
	const last = dates[dates.length - 1]?.slice(0, 10);
	if (!first || !last) return `transactions_${today}.csv`;
	return `transactions_${first}_to_${last}.csv`;
}

/** Triggers a browser download of the CSV export, with user feedback. */
export function downloadTransactionsCsv(transactions: Transaction[]): void {
	if (transactions.length === 0) {
		toast.info("No transactions to export");
		return;
	}

	try {
		const content = buildTransactionsCsv(transactions);
		const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
		const url = URL.createObjectURL(blob);
		const link = document.createElement("a");
		link.setAttribute("href", url);
		link.setAttribute("download", buildCsvFilename(transactions));
		link.style.visibility = "hidden";
		document.body.append(link);
		link.click();
		document.body.removeChild(link);
		URL.revokeObjectURL(url);
		toast.success(
			`Exported ${transactions.length} transaction${
				transactions.length === 1 ? "" : "s"
			} to CSV`,
		);
	} catch (error) {
		console.error("Error exporting CSV:", error);
		toast.error("Failed to export CSV");
	}
}
