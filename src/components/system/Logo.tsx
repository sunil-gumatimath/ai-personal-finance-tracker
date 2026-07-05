import { cn } from "@/lib/utils";

interface LogoProps {
    size?: "sm" | "md" | "lg";
    showText?: boolean;
    vertical?: boolean;
    className?: string;
}

export function Logo({ size = "md", showText = true, vertical = false, className }: LogoProps) {
    const sizeClasses = {
        sm: "h-8 w-8",
        md: "h-10 w-10",
        lg: "h-16 w-16",
    };

    const iconSizes = {
        sm: "h-5 w-5",
        md: "h-6 w-6",
        lg: "h-10 w-10",
    };

    const textSizes = {
        sm: {
            title: "text-[10px] tracking-[0.2em]",
            subtitle: "text-[8px] tracking-widest",
        },
        md: {
            title: "text-xs tracking-[0.25em]",
            subtitle: "text-[9px] tracking-widest",
        },
        lg: {
            title: "text-lg tracking-[0.2em]",
            subtitle: "text-xs tracking-widest",
        },
    };

    const roundedClasses = {
        sm: "rounded-lg",
        md: "rounded-xl",
        lg: "rounded-2xl",
    };

    return (
        <div className={cn(
            "flex items-center",
            vertical ? "flex-col gap-4" : "flex-row gap-3",
            className
        )}>
            {/* Logo Icon Container */}
            <div
                className={cn(
                    "relative flex items-center justify-center overflow-hidden group/logo",
                    "bg-gradient-to-br from-emerald-600 via-emerald-700 to-teal-800",
                    "dark:from-emerald-500 dark:via-emerald-600 dark:to-teal-700",
                    "shadow-lg shadow-emerald-500/25 dark:shadow-emerald-500/20",
                    "border border-emerald-500/30 dark:border-emerald-400/20",
                    sizeClasses[size],
                    roundedClasses[size]
                )}
            >
                {/* Subtle gradient overlay */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-black/10 opacity-60" />

                {/* Glow effect on hover */}
                <div className="absolute -inset-1 bg-emerald-400/30 blur-xl opacity-0 group-hover/logo:opacity-100 transition-opacity duration-500" />

                {/* Finance/Growth Logo SVG */}
                <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    className={cn(
                        iconSizes[size],
                        "relative z-10 transition-all duration-500 group-hover/logo:scale-110"
                    )}
                >
                    {/* Abstract upward growth arrow */}
                    <path
                        d="M12 3L20 11H15V21H9V11H4L12 3Z"
                        fill="currentColor"
                        className="text-white"
                    />
                    {/* Decorative line accent */}
                    <path
                        d="M4 19L8 15M16 15L20 19"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        className="text-white/60"
                    />
                </svg>
            </div>

            {/* Logo Text */}
            {showText && (
                <div className={cn(
                    "flex flex-col",
                    vertical && "items-center"
                )}>
                    <span
                        className={cn(
                            "font-black text-foreground uppercase opacity-90",
                            textSizes[size].title
                        )}
                    >
                        Personal Finance
                    </span>
                    <span
                        className={cn(
                            "font-bold text-emerald-600 dark:text-emerald-500 uppercase mt-0.5 opacity-80",
                            textSizes[size].subtitle
                        )}
                    >
                        Tracker
                    </span>
                </div>
            )}
        </div>
    );
}

