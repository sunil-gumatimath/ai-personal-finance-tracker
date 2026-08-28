import { useEffect } from "react";
import { useAccent } from "./theme-provider";
import { usePreferences } from "@/hooks/usePreferences";

/**
 * Bridges server-synced preferences and the locally-owned accent.
 *
 * The accent lives in two places: `useAccent` (CSS class + localStorage, works
 * pre-auth with no flash) and `PreferencesContext` (the encrypted DB column that
 * follows the user across devices). This component is the one-way sync that
 * applies an accent coming *from* the server onto the local runtime.
 *
 * It is intentionally not two-way: the Settings UI pushes local changes to the
 * DB via `savePreferences`, which echoes them back here. Bail out when the
 * server value equals what we already show so we never loop.
 */
export function AccentSync() {
	const { accent, setAccent } = useAccent();
	const { preferences } = usePreferences();
	const serverAccent = preferences.accent;

	useEffect(() => {
		if (!serverAccent || serverAccent === accent) return;
		setAccent(serverAccent);
	}, [serverAccent, accent, setAccent]);

	return null;
}
