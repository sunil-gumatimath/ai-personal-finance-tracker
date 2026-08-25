/**
 * Shared defensive coercion for money fields.
 *
 * PostgreSQL DECIMAL columns may come back as `number` OR as a numeric
 * `string` depending on the driver/serialization path, so every consumer
 * should funnel raw row values through this helper before doing math.
 */
export function toNumber(value: number | string | null | undefined): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "string") {
		const parsed = parseFloat(value);
		return Number.isNaN(parsed) ? 0 : parsed;
	}
	return 0;
}
