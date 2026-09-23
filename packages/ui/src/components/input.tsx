import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";
import { cn } from "@vireo/ui/lib/utils";

/**
 * Text input. 44px tall like the button, and 16px text on every screen:
 * iOS Safari zooms into any field with smaller text on focus. The border is
 * the `input` token, which the palette tests hold to 3:1 against the page.
 */
function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-11 w-full min-w-0 rounded-lg border border-input bg-card px-3 py-2 text-base transition-colors outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-semibold file:text-foreground placeholder:text-muted-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-muted disabled:opacity-60 aria-invalid:border-destructive aria-invalid:focus-visible:outline-destructive",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
