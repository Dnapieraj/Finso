import { SiteFooter } from "@/components/site/site-footer";
import { SiteHeader } from "@/components/site/site-header";

/*
 * A route group: "(site)" is not part of any URL. It gives the home page
 * and the legal pages one shared header, main landmark and footer.
 */
export default function SiteLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      {/* tabIndex lets the skip link move keyboard focus here. */}
      <main id="tresc" tabIndex={-1} className="flex-1 outline-none">
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
