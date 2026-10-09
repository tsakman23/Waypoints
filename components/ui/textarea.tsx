import * as React from "react"
import { cn } from "cn"

function Textarea({ className, ...props }: React.ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        // Same field treatment as Input.
        "flex field-sizing-content min-h-16 w-full rounded-xl border border-input bg-[rgb(6_8_24/0.6)] px-3 py-2 text-base transition-[border-color,box-shadow] duration-200 ease-(--ease-out) outline-none placeholder:text-muted-foreground hover:border-white/20 focus-visible:border-violet focus-visible:shadow-[0_0_0_4px_rgb(139_108_255/0.22),0_0_24px_rgb(139_108_255/0.25)] disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 md:text-sm",
        className
      )}
      {...props}
    />
  )
}

export { Textarea }
