import * as React from "react"
import * as ProgressPrimitive from "@radix-ui/react-progress"

import { cn } from "@/lib/utils"

/**
 * Progress bar driven by a Radix value (0–100).
 *
 * Escape hatch: set `--progress-color` on this component (or any ancestor) to
 * override the indicator fill, e.g.
 * `<Progress style={{ "--progress-color": "var(--color-income)" }} value={75} />`.
 * Falls back to `var(--color-primary)` when unset. The indicator animates via
 * `transform` only, so it stays cheap to composite.
 */
function Progress({
  className,
  value,
  ...props
}: React.ComponentProps<typeof ProgressPrimitive.Root>) {
  return (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "bg-primary/20 relative h-2 w-full overflow-hidden rounded-full",
        className
      )}
      {...props}
    >
      <ProgressPrimitive.Indicator
        data-slot="progress-indicator"
        className="h-full w-full flex-1 transition-transform"
        style={{
          transform: `translateX(-${100 - (value || 0)}%)`,
          backgroundColor: 'var(--progress-color, var(--color-primary))'
        }}
      />
    </ProgressPrimitive.Root>
  )
}

export { Progress }
