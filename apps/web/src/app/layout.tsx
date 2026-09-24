import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Hanken_Grotesk } from "next/font/google";

import { theme } from "@vireo/ui/tokens";

import { pl } from "@/messages/pl";

import "@vireo/ui/styles/globals.css";

// latin-ext carries the Polish diacritics (ą, ę, ł, ś, ż, …).
const display = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  axes: ["opsz"],
  variable: "--font-display",
  display: "swap",
});

const body = Hanken_Grotesk({
  subsets: ["latin", "latin-ext"],
  variable: "--font-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: pl.meta.title,
  description: pl.meta.description,
  openGraph: {
    type: "website",
    locale: "pl_PL",
    siteName: "Finso",
    title: pl.meta.title,
    description: pl.meta.description,
  },
};

// Mobile browser chrome matches the page background in both themes.
export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: theme.colors.light.background },
    { media: "(prefers-color-scheme: dark)", color: theme.colors.dark.background },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pl"
      // Smooth anchor jumps only for users who have not asked to reduce motion.
      className={`${display.variable} ${body.variable} h-full antialiased motion-safe:scroll-smooth`}
    >
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
