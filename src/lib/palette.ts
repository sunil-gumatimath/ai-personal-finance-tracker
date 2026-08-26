/**
 * Shared selectable color palette used by Categories, Accounts and Debts
 * pickers. Single source of truth so the swatches can never drift apart.
 */
export interface ColorSwatch {
	value: string;
	name: string;
	gradient: string;
}

export const SWATCHES: readonly ColorSwatch[] = [
	{ value: "#3b82f6", name: "Blue", gradient: "from-blue-500 to-blue-600" },
	{ value: "#22c55e", name: "Green", gradient: "from-emerald-500 to-emerald-600" },
	{ value: "#8b5cf6", name: "Purple", gradient: "from-purple-500 to-violet-600" },
	{ value: "#f59e0b", name: "Amber", gradient: "from-amber-500 to-orange-500" },
	{ value: "#ef4444", name: "Red", gradient: "from-red-500 to-rose-600" },
	{ value: "#ec4899", name: "Pink", gradient: "from-pink-500 to-rose-500" },
	{ value: "#06b6d4", name: "Cyan", gradient: "from-cyan-500 to-teal-500" },
	{ value: "#84cc16", name: "Lime", gradient: "from-lime-500 to-green-500" },
	{ value: "#f97316", name: "Orange", gradient: "from-orange-500 to-red-500" },
	{ value: "#6366f1", name: "Indigo", gradient: "from-indigo-500 to-purple-600" },
] as const;

/** Plain hex list, same order as SWATCHES (for compact pickers). */
export const SWATCH_HEXES: readonly string[] = SWATCHES.map((s) => s.value);
