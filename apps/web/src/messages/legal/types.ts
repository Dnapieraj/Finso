/** A piece of a sentence: plain text or a link (internal path or `mailto:`). */
export type Inline = string | { readonly href: string; readonly text: string };

/** One run of text made of inline pieces. */
export type Line = readonly Inline[];

export type LegalBlock =
  | { readonly type: "p"; readonly text: Line }
  | { readonly type: "ul" | "ol"; readonly items: readonly Line[] };

export interface LegalSection {
  /** Anchor id, so a section can be linked directly (e.g. from the app). */
  readonly id: string;
  readonly title: string;
  readonly blocks: readonly LegalBlock[];
}

/**
 * A legal document as data: the copy lives next to the rest of the Polish
 * text, and one component renders every document the same way.
 */
export interface LegalDocument {
  readonly title: string;
  readonly description: string;
  /** Last update, as an ISO date for `<time>` and as Polish text for display. */
  readonly updated: { readonly iso: string; readonly label: string };
  readonly intro: Line;
  readonly sections: readonly LegalSection[];
}
