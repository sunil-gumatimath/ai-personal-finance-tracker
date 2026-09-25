import {
	Activity,
	AlertTriangle,
	FileEdit,
	Info,
	Plus,
	Trash2,
	XCircle,
	type LucideIcon,
} from "lucide-react";

export interface ActionColor {
	bg: string;
	border: string;
	text: string;
	glow: string;
}

export interface SeverityConfig {
	color: string;
	/** Optional filled treatment for high-urgency severities (critical). */
	solid?: string;
	icon: LucideIcon;
	label: string;
}

/** Actions that warrant the alarming rose treatment (DELETE / ERROR only). */
const DESTRUCTIVE_ACTIONS = new Set([
	"TRANSACTION_DELETED",
	"ACCOUNT_DELETED",
	"USER_DELETED",
	"ERROR",
]);

export function getActionColor(action: string): ActionColor {
	if (action === "TRANSACTION_CREATED") {
		return {
			bg: "bg-[var(--success)]/10",
			border: "border-[var(--success)]/20",
			text: "text-[var(--success)]",
			// Full static class strings — dynamically composed variants like
			// `group-hover:${glow}` never compile in Tailwind's source scan.
			glow: "group-hover:shadow-emerald-500/10",
		};
	}
	if (action === "TRANSACTION_EDITED") {
		return {
			bg: "bg-[var(--info)]/10",
			border: "border-[var(--info)]/20",
			text: "text-[var(--info)]",
			glow: "group-hover:shadow-blue-500/10",
		};
	}
	if (DESTRUCTIVE_ACTIONS.has(action)) {
		return {
			bg: "bg-destructive/10",
			border: "border-rose-500/20",
			text: "text-destructive",
			glow: "group-hover:shadow-rose-500/10",
		};
	}
	// Neutral fallback — routine events (USER_LOGIN etc.) should not read as
	// errors; rose is reserved for DELETE/ERROR above.
	return {
		bg: "bg-muted",
		border: "border-border",
		text: "text-muted-foreground",
		glow: "group-hover:shadow-foreground/5",
	};
}

export function getSeverityConfig(severity: string): SeverityConfig {
	switch (severity) {
		case "critical":
			return {
				color: "bg-destructive/15 text-destructive border-destructive/25",
				// Filled treatment: weight (solid fill), not hue alone, is what
				// separates Critical(red) from Error(rose) at a glance.
				solid: "bg-red-600 text-white border-red-600 shadow-sm",
				icon: AlertTriangle,
				label: "Critical",
			};
		case "error":
			return {
				color: "bg-destructive/15 text-destructive border-destructive/25",
				icon: XCircle,
				label: "Error",
			};
		case "warning":
			return {
				color: "bg-[var(--warning)]/15 text-[var(--warning)] border-[var(--warning)]/25",
				icon: AlertTriangle,
				label: "Warning",
			};
		default:
			return {
				color: "bg-[var(--info)]/10 text-[var(--info)] border-[var(--info)]/20",
				icon: Info,
				label: "Info",
			};
	}
}

export function getActionIconComponent(action: string): LucideIcon {
	if (action === "TRANSACTION_CREATED") return Plus;
	if (action === "TRANSACTION_EDITED") return FileEdit;
	if (action === "TRANSACTION_DELETED") return Trash2;
	return Activity;
}
