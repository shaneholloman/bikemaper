import { cn } from "@/lib/utils"
import { CornerDownLeft } from "lucide-react"

function Kbd({ className, ...props }: React.ComponentProps<"kbd">) {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground pointer-events-none inline-flex h-5 w-fit min-w-5 items-center justify-center gap-1 rounded-sm px-1 font-sans text-xs font-medium select-none",
        "[&_svg:not([class*='size-'])]:size-3",
        "[[data-slot=tooltip-content]_&]:bg-background/20 [[data-slot=tooltip-content]_&]:text-background dark:[[data-slot=tooltip-content]_&]:bg-background/10",
        className
      )}
      {...props}
    />
  )
}

function KbdGroup({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <kbd
      data-slot="kbd-group"
      className={cn("inline-flex items-center gap-1", className)}
      {...props}
    />
  )
}

/**
 * Enter key hint that shows only when parent CommandItem is selected.
 * Parent must have `className="group"` for the visibility toggle to work.
 */
function EnterHint({ className, ...props }: React.ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "hidden items-center gap-[3px] text-[12px] text-muted-foreground group-data-[selected=true]:flex mr-1 opacity-70",
        className
      )}
      {...props}
    >
      <kbd className="inline-flex items-center justify-center rounded bg-transparent scale-90">
        <CornerDownLeft className="" />
      </kbd>
      <span>Enter</span>
    </span>
  )
}

export { EnterHint, Kbd, KbdGroup }

