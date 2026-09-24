import { buttonVariants } from "@vireo/ui/components/button";
import { cn } from "@vireo/ui/lib/utils";

import { storeLinks } from "@/content/links";
import { pl } from "@/messages/pl";

const t = pl.stores;

/*
 * Plain links styled as buttons: they navigate, so they must be <a>, not
 * <button>. Before launch these can be swapped for the official store
 * badges, which Apple and Google require in their marketing guidelines.
 */
const stores = [
  { href: storeLinks.appStore, prefix: t.appStorePrefix, name: t.appStore },
  { href: storeLinks.googlePlay, prefix: t.googlePlayPrefix, name: t.googlePlay },
] as const;

/** "Download on App Store / Google Play" links. The only call to action on the site. */
export function StoreButtons({ label, className }: { label: string; className?: string }) {
  return (
    <ul aria-label={label} className={cn("flex flex-wrap gap-3", className)}>
      {stores.map((store) => (
        <li key={store.name}>
          <a
            href={store.href}
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-14 min-w-44 flex-col items-start gap-0 px-5 leading-tight",
            )}
          >
            <span className="text-xs font-medium">{store.prefix}</span>
            <span className="text-lg">{store.name}</span>
          </a>
        </li>
      ))}
    </ul>
  );
}
