interface PayoffProgressRingProps {
  percentage: number;
  color?: string;
}

export function PayoffProgressRing({
  percentage,
  color = "var(--color-savings)",
}: PayoffProgressRingProps) {
  const radius = 22;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex items-center justify-center h-14 w-14 shrink-0">
      <svg className="w-full h-full transform -rotate-90">
        <circle
          cx="28"
          cy="28"
          r={radius}
          className="stroke-muted"
          strokeWidth="3.5"
          fill="transparent"
        />
        <circle
          cx="28"
          cy="28"
          r={radius}
          stroke={color}
          strokeWidth="3.5"
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className="text-[10px] font-bold">{Math.round(percentage)}%</span>
      </div>
    </div>
  );
}
