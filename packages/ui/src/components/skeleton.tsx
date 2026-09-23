import { cn } from "@vireo/ui/lib/utils";

/**
 * Placeholder shape shown while data loads. Hidden from screen readers: the
 * loading region should announce itself instead (e.g. `aria-busy` on it).
 * Pulses only for users who have not asked the system to reduce motion.
 */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      aria-hidden="true"
      className={cn("rounded-lg bg-muted motion-safe:animate-pulse", className)}
      {...props}
    />
  );
}

export { Skeleton };
