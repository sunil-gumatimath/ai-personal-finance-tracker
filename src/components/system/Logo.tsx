import { cn } from "@/lib/utils";

interface LogoProps {
	size?: "sm" | "md" | "lg" | "xl";
	showText?: boolean;
	vertical?: boolean;
	className?: string;
}

export function Logo({
	size = "md",
	showText = true,
	vertical = false,
	className,
}: LogoProps) {
	const iconSizes = {
		sm: "h-5 w-5",
		md: "h-6 w-6",
		lg: "h-9 w-9",
		xl: "h-12 w-12",
	};

	const textSizes = {
		sm: {
			title: "text-sm font-extrabold tracking-[-0.03em]",
			subtitle: "text-[9px] font-semibold tracking-wider",
		},
		md: {
			title: "text-base font-extrabold tracking-[-0.03em]",
			subtitle: "text-[10px] font-semibold tracking-wider",
		},
		lg: {
			title: "text-2xl font-extrabold tracking-[-0.035em]",
			subtitle: "text-xs font-semibold tracking-wider",
		},
		xl: {
			title: "text-3xl font-extrabold tracking-[-0.04em]",
			subtitle: "text-sm font-semibold tracking-wider",
		},
	};

	return (
		<div
			className={cn(
				"inline-flex items-center select-none",
				vertical ? "flex-col gap-3 text-center" : "flex-row gap-2.5",
				className,
			)}
		>
			{/* Pure Standalone Vector Glyph (No box / container) */}
			<svg
				viewBox="0 0 28 28"
				fill="none"
				xmlns="http://www.w3.org/2000/svg"
				className={cn(
					iconSizes[size],
					"shrink-0",
				)}
				aria-hidden="true"
			>
				<defs>
					<linearGradient
						id="fintrack-glyph-grad"
						x1="4"
						y1="4"
						x2="24"
						y2="24"
						gradientUnits="userSpaceOnUse"
					>
						<stop stopColor="var(--primary)" />
						<stop offset="1" stopColor="var(--primary)" stopOpacity="0.8" />
					</linearGradient>
				</defs>

				{/* Primary Ascending Growth Chevron */}
				<path
					d="M4.5 13.5L14 4L23.5 13.5"
					stroke="url(#fintrack-glyph-grad)"
					strokeWidth="3.25"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Interlocking Base Chevron */}
				<path
					d="M7.5 21L14 14.5L20.5 21"
					stroke="currentColor"
					className="text-foreground/40 dark:text-foreground/35"
					strokeWidth="3.25"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</svg>

			{/* Typography / Wordmark */}
			{showText && (
				<div
					className={cn(
						"flex flex-col leading-none",
						vertical ? "items-center" : "items-start",
					)}
				>
					<span
						className={cn(
							"text-foreground tracking-[-0.03em]",
							textSizes[size].title,
						)}
					>
						Fin<span className="text-primary font-black ml-[1px]">Track</span>
					</span>
					<div className="flex items-center gap-1 mt-1">
						<span
							className={cn(
								"uppercase text-muted-foreground/75 font-bold tracking-wider",
								textSizes[size].subtitle,
							)}
						>
							AI Finance
						</span>
					</div>
				</div>
			)}
		</div>
	);
}

