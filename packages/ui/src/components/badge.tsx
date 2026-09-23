import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@vireo/ui/lib/utils";

/*
 * `safe`, `caution` and `risk` are Finso's "can I afford it" levels. Color
 * is never the only signal (WCAG 1.4.1): the badge text must say the level.
 */
const badgeVariants = cva(
  "group/badge inline-flex h-6 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-full border border-transparent px-2.5 text-xs font-semibold whitespace-nowrap transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2 aria-invalid:border-destructive [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/90",
        secondary: "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive: "bg-destructive/10 text-destructive [a]:hover:bg-destructive/15",
        outline: "border-input text-foreground [a]:hover:bg-muted",
        ghost: "hover:bg-muted",
        link: "text-primary underline underline-offset-4",
        safe: "bg-safe-subtle text-safe",
        caution: "bg-caution-subtle text-caution",
        risk: "bg-risk-subtle text-risk",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

/** Short status label, e.g. `<Badge variant="caution">Na styk</Badge>`. */
function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
