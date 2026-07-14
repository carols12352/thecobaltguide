"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import type { MapPlace } from "@/types/domain";

const MerchantMap = dynamic(
  () => import("@/components/map/merchant-map").then((module) => module.MerchantMap),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center bg-zinc-100 dark:bg-zinc-900" aria-live="polite">
        <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
          <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt-600" aria-hidden="true" />
          Loading map preview…
        </div>
      </div>
    ),
  },
);

const PREVIEW_FILTERS = { multiplier: "", category: "" } as const;

export function MapPreview() {
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);

  return (
    <div className="relative h-[28rem] overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-950/5 sm:h-[34rem] dark:border-zinc-800 dark:bg-zinc-900">
      <MerchantMap
        filters={PREVIEW_FILTERS}
        selectedPlace={selectedPlace}
        onPlaceSelect={setSelectedPlace}
      />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-zinc-950/55 to-transparent px-4 pb-4 pt-16 sm:justify-end sm:px-5 sm:pb-5">
        <Link
          href="/map"
          className="pointer-events-auto inline-flex h-11 items-center justify-center rounded-lg bg-white px-4 text-sm font-semibold text-zinc-900 shadow-lg transition-[background-color,transform,box-shadow] duration-200 ease-out hover:-translate-y-px hover:bg-zinc-50 hover:shadow-xl active:translate-y-0 active:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:ring-offset-2"
        >
          Open full map <span className="ml-2" aria-hidden="true">→</span>
        </Link>
      </div>
    </div>
  );
}
