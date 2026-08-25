/**
 * PostgreSQL DATE often comes back as 'YYYY-MM-DD'. `new Date('YYYY-MM-DD')`
 * parses as UTC midnight and can shift to the previous/next calendar day in
 * local timezones, so date-only values must be parsed as LOCAL dates.
 */
export function parseTransactionDate(val: unknown): Date {
	if (val instanceof Date) return val;
	if (typeof val === "string") {
		const match = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/.exec(val);
		if (match) {
			const year = Number(match[1]);
			const month = Number(match[2]);
			const day = Number(match[3]);
			return new Date(year, month - 1, day);
		}
		return new Date(val);
	}
	return new Date(NaN);
}

/** Local YYYY-MM-DD string for a Date (avoids UTC off-by-one when persisting). */
export function toLocalDateString(date: Date): string {
	const year = date.getFullYear();
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${year}-${month}-${day}`;
}
