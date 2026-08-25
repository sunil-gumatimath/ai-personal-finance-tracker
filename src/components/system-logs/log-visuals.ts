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
	icon: LucideIcon;
	label: string;
}

export function getActionColor(action: string): ActionColor {
	if (action === "TRANSACTION_CREATED") {
		return {
			bg: "bg-emerald-500/10",
			border: "border-emerald-500/20",
			text: "text-emerald-600",
			// Full static class strings — dynamically composed variants like
			// `group-hover:${glow}` never compile in Tailwind's source scan.
			glow: "group-hover:shadow-emerald-500/10",
		};
	}
	if (action === "TRANSACTION_EDITED") {
		return {
			bg: "bg-blue-500/10",
			border: "border-blue-500/20",
			text: "text-blue-600",
			glow: "group-hover:shadow-blue-500/10",
		};
	}
	return {
		bg: "bg-rose-500/10",
		border: "border-rose-500/20",
		text: "text-rose-600",
		glow: "group-hover:shadow-rose-500/10",
	};
}

export function getSeverityConfig(severity: string): SeverityConfig {
	switch (severity) {
		case "critical":
			return {
				color: "bg-red-500/15 text-red-600 border-red-500/25",
				icon: AlertTriangle,
				label: "Critical",
			};
		case "error":
			return {
				color: "bg-rose-500/15 text-rose-600 border-rose-500/25",
				icon: XCircle,
				label: "Error",
			};
		case "warning":
			return {
				color: "bg-amber-500/15 text-amber-600 border-amber-500/25",
				icon: AlertTriangle,
				label: "Warning",
			};
		default:
			return {
				color: "bg-sky-500/10 text-sky-600 border-sky-500/20",
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
