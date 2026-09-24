import Link from "next/link";

import { cn } from "@vireo/ui/lib/utils";

import { containerClass, textLinkClass } from "@/components/site/classes";
import type { LegalDocument as LegalDocumentData, Line } from "@/messages/legal/types";
import { pl } from "@/messages/pl";

const linkClass = cn(textLinkClass, "font-semibold text-primary underline");

function InlineText({ line }: { line: Line }) {
  return line.map((part, index) => {
    if (typeof part === "string") return part;
    // Parts never reorder, so the index is a stable key.
    return part.href.startsWith("/") ? (
      <Link key={index} href={part.href} className={linkClass}>
        {part.text}
      </Link>
    ) : (
      <a key={index} href={part.href} className={linkClass}>
        {part.text}
      </a>
    );
  });
}

/**
 * Renders a legal document. Each section is a labelled region, so screen
 * reader users can jump between them like between page landmarks.
 */
export function LegalDocument({ document }: { document: LegalDocumentData }) {
  return (
    <article className={cn(containerClass, "max-w-3xl py-12 sm:py-16")}>
      <header className="flex flex-col gap-3 border-b pb-8">
        <h1 className="font-heading text-4xl font-bold tracking-tight text-balance sm:text-5xl">
          {document.title}
        </h1>
        <p className="text-sm text-muted-foreground">
          {pl.legal.updated} <time dateTime={document.updated.iso}>{document.updated.label}</time>
        </p>
        <p className="text-lg text-pretty text-muted-foreground">
          <InlineText line={document.intro} />
        </p>
      </header>

      <div className="flex flex-col gap-10 pt-10">
        {document.sections.map((section) => {
          const headingId = `${section.id}-title`;
          return (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={headingId}
              className="flex scroll-mt-20 flex-col gap-4"
            >
              <h2 id={headingId} className="font-heading text-2xl font-semibold tracking-tight">
                {section.title}
              </h2>
              {section.blocks.map((block, index) => {
                if (block.type === "p") {
                  return (
                    <p key={index} className="leading-relaxed text-pretty">
                      <InlineText line={block.text} />
                    </p>
                  );
                }
                const List = block.type;
                return (
                  <List
                    key={index}
                    className={cn(
                      "flex flex-col gap-2 pl-6 leading-relaxed marker:text-muted-foreground",
                      List === "ol" ? "list-decimal" : "list-disc",
                    )}
                  >
                    {block.items.map((item, itemIndex) => (
                      <li key={itemIndex} className="pl-1">
                        <InlineText line={item} />
                      </li>
                    ))}
                  </List>
                );
              })}
            </section>
          );
        })}
      </div>
    </article>
  );
}
