import type { LogEntry } from "@/types/api";

/**
 * Optional formatting overrides threaded from user preferences. Omitted
 * fields fall back to the historical defaults (USD / en-US).
 */
export interface FormatOptions {
	currency?: string;
	locale?: string;
}

const DEFAULT_FORMAT_OPTIONS: Required<FormatOptions> = {
	currency: "USD",
	locale: "en-US",
};

function resolveFormatOptions(opts?: FormatOptions): Required<FormatOptions> {
	return { ...DEFAULT_FORMAT_OPTIONS, ...opts };
}

export function formatAction(action: string): string {
	const actionMap: Record<string, string> = {
		TRANSACTION_CREATED: "Transaction Created",
		TRANSACTION_EDITED: "Transaction Edited",
		TRANSACTION_DELETED: "Transaction Deleted",
		ACCOUNT_CREATED: "Account Added",
		ACCOUNT_EDITED: "Account Updated",
		ACCOUNT_DELETED: "Account Removed",
		RECURRING_OCCURRENCE_CREATED: "Recurring Transaction Applied",
		RECURRING_SERIES_COMPLETED: "Recurring Series Completed",
		USER_SIGNUP: "Signed Up",
		USER_LOGIN: "Logged In",
		USER_DELETED: "Account Deleted",
		ERROR: "System Error",
		DEPLOYMENT_EVENT: "Deployment",
	};
	return (
		actionMap[action] ||
		action.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

export function formatResource(resource: string): {
	type: string;
	id: string;
	short: string;
} {
	const parts = resource.split("/");
	const type = parts[0] || resource;
	const id = parts[1] || "";
	const short = id ? `${type}#${id.slice(0, 8)}...` : type;
	return { type, id, short };
}

export function formatTimestamp(timestamp: string): {
	absolute: string;
	relative: string;
} {
	const date = new Date(timestamp);
	const absolute = date.toLocaleString();

	const now = new Date();
	const diffMs = now.getTime() - date.getTime();
	const diffSec = Math.floor(diffMs / 1000);
	const diffMin = Math.floor(diffSec / 60);
	const diffHr = Math.floor(diffMin / 60);
	const diffDay = Math.floor(diffHr / 24);

	let relative: string;
	if (diffSec < 60) relative = "just now";
	else if (diffMin < 60) relative = `${diffMin}m ago`;
	else if (diffHr < 24) relative = `${diffHr}h ago`;
	else if (diffDay < 7) relative = `${diffDay}d ago`;
	else relative = date.toLocaleDateString();

	return { absolute, relative };
}

/**
 * Formats an amount as currency using the provided (or default) currency and
 * locale. Callers that know the user's preferences thread them through
 * `opts`; currency-blind callers keep the "USD"/"en-US" behavior.
 */
function formatCurrency(amount: string | number, opts?: FormatOptions): string {
	const { currency, locale } = resolveFormatOptions(opts);
	const num = typeof amount === "string" ? parseFloat(amount) : amount;
	if (isNaN(num)) return String(amount);
	return new Intl.NumberFormat(locale, {
		style: "currency",
		currency,
	}).format(num);
}

export function formatFieldName(field: string): string {
	const fieldMap: Record<string, string> = {
		amount: "Amount",
		description: "Description",
		notes: "Notes",
		date: "Date",
		type: "Type",
		is_recurring: "Recurring",
		recurring_frequency: "Frequency",
		category_id: "Category",
		account_id: "Account",
		to_account_id: "Transfer To",
		updated_at: "Updated At",
		created_at: "Created At",
		user_id: "User",
		id: "ID",
	};
	return (
		fieldMap[field] ||
		field.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
	);
}

export function shouldShowField(field: string): boolean {
	const hiddenFields = ["id", "user_id", "created_at"];
	return !hiddenFields.includes(field);
}

export function formatFieldValue(
	field: string,
	value: unknown,
	opts?: FormatOptions,
): string {
	if (value === null || value === undefined) return "None";

	if (field === "amount" && (typeof value === "number" || typeof value === "string")) {
		return formatCurrency(value, opts);
	}
	if (field === "date" && (typeof value === "string" || typeof value === "number" || value instanceof Date)) {
		return new Date(value).toLocaleDateString();
	}
	if ((field === "updated_at" || field === "created_at") && (typeof value === "string" || typeof value === "number" || value instanceof Date)) {
		return new Date(value).toLocaleString();
	}
	if (field === "type" && typeof value === "string") {
		return value.charAt(0).toUpperCase() + value.slice(1);
	}
	if (field === "is_recurring") return value ? "Yes" : "No";
	if (field === "description" || field === "notes") return String(value || "None");

	return String(value);
}

export function safeJsonParse<T>(value: string | null | undefined): T | null {
	if (!value) return null;
	try {
		return JSON.parse(value) as T;
	} catch {
		return null;
	}
}

export function generateHumanDescription(
	log: LogEntry,
	opts?: FormatOptions,
): string {
	const resource = formatResource(log.resource);
	const action = formatAction(log.action);
	const user = log.userEmail || "System";

	if (log.action === "TRANSACTION_CREATED") {
		const newValue = safeJsonParse<{
			amount?: string | number;
			description?: string;
		}>(log.newValue);
		const amount = newValue?.amount
			? formatCurrency(newValue.amount, opts)
			: "unknown amount";
		const desc = newValue?.description || "no description";
		return `${user} created ${resource.type} - ${amount} (${desc})`;
	}

	if (log.action === "TRANSACTION_DELETED") {
		const oldValue = safeJsonParse<{
			amount?: string | number;
			description?: string;
		}>(log.oldValue);
		const amount = oldValue?.amount
			? formatCurrency(oldValue.amount, opts)
			: "unknown amount";
		const desc = oldValue?.description || "no description";
		return `${user} deleted ${resource.type} - ${amount} (${desc})`;
	}

	if (log.action === "TRANSACTION_EDITED") {
		const changes = getFieldChanges(log.oldValue, log.newValue);
		const changeSummary = changes
			.slice(0, 2)
			.map((c) => c.summary)
			.join(", ");
		const more = changes.length > 2 ? ` and ${changes.length - 2} more` : "";
		return `${user} edited ${resource.type} - ${changeSummary}${more}`;
	}

	if (log.action === "USER_LOGIN") {
		return log.status === "failure"
			? `Failed login attempt for ${user}`
			: `${user} logged in`;
	}

	if (log.action === "USER_SIGNUP") {
		return `${user} created an account`;
	}

	if (log.action === "USER_DELETED") {
		return `${user} deleted their account and all associated data`;
	}

	if (
		log.action === "ACCOUNT_CREATED" ||
		log.action === "ACCOUNT_EDITED" ||
		log.action === "ACCOUNT_DELETED"
	) {
		const parsed = safeJsonParse<{ name?: string; balance?: string | number }>(
			log.action === "ACCOUNT_DELETED" ? log.oldValue : log.newValue,
		);
		const name = parsed?.name || resource.short;
		const verb =
			log.action === "ACCOUNT_CREATED"
				? "added"
				: log.action === "ACCOUNT_EDITED"
					? "updated"
					: "removed";
		const balance = parsed?.balance
			? ` (balance ${formatCurrency(parsed.balance, opts)})`
			: "";
		return `${user} ${verb} account "${name}"${balance}`;
	}

	if (log.action === "RECURRING_OCCURRENCE_CREATED") {
		const newValue = safeJsonParse<{
			amount?: string | number;
			description?: string;
		}>(log.newValue);
		const amount = newValue?.amount
			? formatCurrency(newValue.amount, opts)
			: "unknown amount";
		const desc = newValue?.description || "no description";
		return `${user}'s recurring transaction applied - ${amount} (${desc})`;
	}

	if (log.action === "RECURRING_SERIES_COMPLETED") {
		return `${user}'s recurring series ran to completion`;
	}

	if (log.action === "ERROR") {
		return `System error encountered (${resource.short})`;
	}

	if (log.action === "DEPLOYMENT_EVENT") {
		return `Deployment event: ${resource.short}`;
	}

	return `${user} ${action.toLowerCase()} ${resource.short}`;
}

interface FieldChange {
	field: string;
	oldValue: unknown;
	newValue: unknown;
	summary: string;
}

export function getFieldChanges(
	oldValue: string | null,
	newValue: string | null,
	opts?: FormatOptions,
): FieldChange[] {
	if (!oldValue || !newValue) return [];

	try {
		const oldObj =
			typeof oldValue === "string" ? JSON.parse(oldValue) : oldValue;
		const newObj =
			typeof newValue === "string" ? JSON.parse(newValue) : newValue;

		const changes: FieldChange[] = [];
		const allKeys = new Set([...Object.keys(oldObj), ...Object.keys(newObj)]);

		for (const key of allKeys) {
			if (!shouldShowField(key)) continue;

			const oldVal = oldObj[key];
			const newVal = newObj[key];

			if (oldVal !== newVal) {
				const fieldName = formatFieldName(key);
				const oldFormatted = formatFieldValue(key, oldVal, opts);
				const newFormatted = formatFieldValue(key, newVal, opts);

				let summary: string;
				if (oldVal === null || oldVal === undefined) {
					summary = `${fieldName} set to ${newFormatted}`;
				} else if (newVal === null || newVal === undefined) {
					summary = `${fieldName} removed`;
				} else {
					summary = `${fieldName}: ${oldFormatted} → ${newFormatted}`;
				}

				changes.push({
					field: key,
					oldValue: oldVal,
					newValue: newVal,
					summary,
				});
			}
		}

		return changes;
	} catch {
		return [];
	}
}

export function formatMetadata(
	metadata: Record<string, unknown>,
	opts?: FormatOptions,
): Array<{ label: string; value: string }> {
	return Object.entries(metadata).map(([key, value]) => {
		const label = formatFieldName(key);
		let formattedValue: string;

		if (key.toLowerCase().includes("amount") && (typeof value === "number" || typeof value === "string")) {
			formattedValue = formatCurrency(value, opts);
		} else if (
			(key.toLowerCase().includes("date") ||
			key.toLowerCase().includes("time")) &&
			(typeof value === "string" || typeof value === "number" || value instanceof Date)
		) {
			formattedValue = new Date(value).toLocaleString();
		} else if (typeof value === "boolean") {
			formattedValue = value ? "Yes" : "No";
		} else if (value === null || value === undefined) {
			formattedValue = "None";
		} else {
			formattedValue = String(value);
		}

		return { label, value: formattedValue };
	});
}
