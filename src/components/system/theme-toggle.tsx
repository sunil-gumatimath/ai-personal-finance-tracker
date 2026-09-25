import { Check } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { THEME_OPTIONS, ACCENT_OPTIONS } from "./themes";
import { useAccent } from "./theme-provider";
import { usePreferences } from "@/hooks/usePreferences";
import { cn } from "@/lib/utils";

/**
 * The single appearance control, shown in the header on every authenticated
 * screen and on the auth screens.
 *
 * Previously the header offered a `Palette`-icon dropdown containing only
 * Light/Dark/System (no accent, despite the icon), while Settings had a
 * completely different tile-based picker for the same setting. Both now render
 * the same theme + accent groups, so the icon matches the contents and there is
 * only one appearance control to reason about.
 */
export function ThemeToggle({ className }: { className?: string }) {
	const { theme, setTheme } = useTheme();
	const { accent, setAccent } = useAccent();
	const { savePreferences } = usePreferences();

	const handleAccentSelect = (value: (typeof ACCENT_OPTIONS)[number]["value"]) => {
		// Apply locally first (no flash), then sync so the choice follows the user
		// across devices. A failed sync surfaces rather than being swallowed.
		setAccent(value);
		savePreferences({ accent: value }).catch(() => {
			toast.error("Accent couldn't be synced to your account.");
		});
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="icon"
					aria-label="Appearance: theme and accent color"
					className={cn("size-9 cursor-pointer", className)}
				>
					<SunMoon />
					<span className="sr-only">Toggle appearance</span>
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				<DropdownMenuGroup>
					<DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
						Theme
					</DropdownMenuLabel>
					{THEME_OPTIONS.map(({ value, label, icon: Icon }) => (
						<DropdownMenuItem key={value} onClick={() => setTheme(value)}>
							<Icon />
							{label}
							{theme === value && <Check className="ml-auto" />}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
				<DropdownMenuSeparator />
				<DropdownMenuGroup>
					<DropdownMenuLabel className="text-[11px] uppercase tracking-wider text-muted-foreground">
						Accent
					</DropdownMenuLabel>
					{ACCENT_OPTIONS.map(({ value, label, icon: Icon }) => (
						<DropdownMenuItem
							key={value}
							onClick={() => handleAccentSelect(value)}
							className="cursor-pointer"
						>
							<Icon className="text-muted-foreground" />
							{label}
							{accent === value && <Check className="ml-auto" />}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

/** Reflects the live theme so the trigger icon is meaningful, not decorative. */
function SunMoon() {
	const { resolvedTheme } = useTheme();
	if (resolvedTheme === "dark") return <MoonIcon />;
	return <SunIcon />;
}

function SunIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			className="size-4"
			aria-hidden="true"
		>
			<circle cx="12" cy="12" r="4" />
			<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
		</svg>
	);
}

function MoonIcon() {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
			className="size-4"
			aria-hidden="true"
		>
			<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
		</svg>
	);
}
