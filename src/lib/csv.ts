/** RFC 4180 field escaping: quote when needed, double internal quotes. */
export function escapeCsvField(
	field: string | number | null | undefined,
): string {
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
