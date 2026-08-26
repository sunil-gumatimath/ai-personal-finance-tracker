/**
 * Derives up-to-two uppercase initials from a person's name (or email
 * address) for avatar fallbacks. Falls back to "U" when nothing usable
 * is provided.
 */
export function getInitials(name?: string | null): string {
	if (!name) return "U";
	return (
		name
			.split(" ")
			.filter(Boolean)
			.map((part) => part[0])
			.join("")
			.toUpperCase()
			.slice(0, 2) || "U"
	);
}
