import { Money } from "@vireo/ui/components/money";

import type { RichText as RichTextParts } from "@/messages/pl";

/** Renders copy that mixes text with amounts; amounts go through `Money`. */
export function RichText({ parts }: { parts: RichTextParts }) {
  return parts.map((part, index) =>
    typeof part === "string" ? (
      part
    ) : (
      <Money
        // Parts never reorder, so the index is a stable key.
        key={index}
        amount={part.amount}
        whole={part.whole}
        sign={part.sign}
        className="font-semibold text-foreground"
      />
    ),
  );
}
