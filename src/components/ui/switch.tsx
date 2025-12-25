import * as React from "react"
import { cn } from "@/lib/utils"

const Switch = React.forwardRef<
    HTMLInputElement,
    React.InputHTMLAttributes<HTMLInputElement>
>(({ className, ...props }, ref) => (
    <label className="relative inline-flex items-center cursor-pointer">
        <input
            type="checkbox"
            className="peer sr-only"
            ref={ref}
            {...props}
        />
        <div className={cn(
            "h-6 w-11 rounded-full border-2 border-transparent bg-input transition-colors",
            "peer-checked:bg-primary",
            "peer-disabled:cursor-not-allowed peer-disabled:opacity-50",
            className
        )} />
        <div className={cn(
            "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform pointer-events-none",
            "peer-checked:translate-x-5"
        )} />
    </label>
))
Switch.displayName = "Switch"

export { Switch }
