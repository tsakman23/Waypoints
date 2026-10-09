import * as React from "react"
import { cn } from "cn"

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <input
      type={type}
      data-slot="input"
      className={cn(
        // Night Sky field: dark glass, brighter edge on hover, violet ring and glow on focus.
        "h-9 w-full min-w-0 rounded-xl border border-input bg-[rgb(6_8_24/0.6)] px-3 py-1 text-base transition-[border-color,box-shadow] duration-200 ease-(--ease-out) outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground hover:border-white/20 focus-visible:border-violet focus-visible:shadow-[0_0_0_4px_rgb(139_108_255/0.22),0_0_24px_rgb(139_108_255/0.25)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Input }
