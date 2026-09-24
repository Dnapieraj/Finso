import { cn } from "@vireo/ui/lib/utils";

/** Shared page width and side padding for every landing section. */
export const containerClass = "mx-auto w-full max-w-6xl px-4 sm:px-6";

/** Focus ring for plain text links; buttons get theirs from `buttonVariants`. */
export const textLinkClass =
  "rounded-sm underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2";

/**
 * A landing section with a heading that names it for screen readers.
 * `scroll-mt` keeps the heading clear of the sticky header on anchor jumps.
 */
export function Section({
  id,
  title,
  lead,
  className,
  children,
}: {
  id: string;
  title: string;
  lead: string;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = `${id}-title`;
  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-20 py-16 sm:py-24", className)}
    >
      <div className={containerClass}>
        <div className="flex max-w-2xl flex-col gap-3">
          <h2
            id={headingId}
            className="font-heading text-3xl font-bold tracking-tight text-balance sm:text-4xl"
          >
            {title}
          </h2>
          <p className="text-lg text-pretty text-muted-foreground">{lead}</p>
        </div>
        <div className="mt-10 sm:mt-12">{children}</div>
      </div>
    </section>
  );
}
