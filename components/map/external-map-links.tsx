import {
  buildExternalMapLinks,
  EXTERNAL_MAP_ICON_URLS,
} from "@/lib/map/external-map-links";
import { cn } from "@/lib/utils";

interface ExternalMapLinksProps {
  latitude: number;
  longitude: number;
  placeName: string;
  addressLine1?: string;
  city?: string;
  province?: string;
  postalCode?: string;
  googlePlaceId?: string | null;
  className?: string;
}

export function ExternalMapLinks({
  latitude,
  longitude,
  placeName,
  addressLine1,
  city,
  province,
  postalCode,
  googlePlaceId,
  className,
}: ExternalMapLinksProps) {
  const links = buildExternalMapLinks({
    latitude,
    longitude,
    label: placeName,
    addressLine1,
    city,
    province,
    postalCode,
    googlePlaceId,
  });

  if (links.length === 0) return null;

  return (
    <nav
      aria-label={`Open ${placeName} in an external map`}
      className={cn("flex flex-wrap items-center gap-2", className)}
    >
      <span className="mr-1 text-xs font-medium text-zinc-500">Open in</span>
      {links.map((link) => (
        <a
          key={link.provider}
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-9 items-center gap-2 rounded-lg border border-zinc-300 bg-white px-3 text-sm font-medium text-zinc-700 shadow-sm transition-[background-color,border-color,color,transform] duration-150 hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:ring-offset-2 active:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-white"
        >
          {/* Brand SVGs are intentionally referenced from their external CDN. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={EXTERNAL_MAP_ICON_URLS[link.provider]}
            alt=""
            aria-hidden="true"
            width={16}
            height={16}
            className="h-4 w-4 shrink-0"
          />
          {link.label}
          <span className="sr-only"> (opens in a new tab)</span>
        </a>
      ))}
    </nav>
  );
}
