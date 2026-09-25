import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

/**
 * The one balance-visibility control, shared by every page that shows money.
 *
 * `showBalances` used to be per-page `useState`, which meant (a) MainLayout's
 * `key={pathname}` remount silently un-hid balances on every navigation and
 * (b) hiding them on Accounts left the Dashboard and Reports fully visible. The
 * state now lives in Preferences (persisted + synced) and this component
 * renders the identical affordance everywhere.
 */
export function BalanceVisibilityToggle({
	className,
	size = "icon",
}: {
	className?: string;
	size?: "icon" | "sm";
}) {
	const { preferences, savePreferences } = usePreferences();
	const hidden = preferences.hideBalances;

	const toggle = () => {
		void savePreferences({ hideBalances: !hidden });
	};

	return (
		<Button
			variant="outline"
			size={size}
			onClick={toggle}
			aria-pressed={hidden}
			title={hidden ? "Show balances" : "Hide balances"}
			aria-label={hidden ? "Show balances" : "Hide balances"}
			className={cn("cursor-pointer", className)}
		>
			{hidden ? (
				<EyeOff className={size === "icon" ? "h-5 w-5" : "h-3.5 w-3.5"} />
			) : (
				<Eye className={size === "icon" ? "h-5 w-5" : "h-3.5 w-3.5"} />
			)}
			{size === "sm" && <span>{hidden ? "Show" : "Hide"}</span>}
		</Button>
	);
}
