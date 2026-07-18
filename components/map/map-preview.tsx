"use client";

import { useCallback, useEffect, useRef, useState, type ComponentType } from "react";
import Link from "next/link";
import type { MapPlace } from "@/types/domain";
import type { MapFilters } from "@/components/filters/map-filters";

type MerchantMapProps = {
  filters: MapFilters;
  selectedPlace?: MapPlace | null;
  onPlaceSelect?: (place: MapPlace) => void;
};

type MerchantMapComponent = ComponentType<MerchantMapProps>;

type PreviewStatus = "deferred" | "loading" | "ready" | "error";

const PREVIEW_FILTERS = { multiplier: "", category: "" } as const;

const PREVIEW_HEIGHT_CLASS = "min-h-[28rem] sm:min-h-[32rem]";

function MapPlaceholder({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden bg-[#f4f1ea]" aria-hidden="true">
      <div className="absolute inset-0 opacity-70" style={{
        backgroundImage:
          "linear-gradient(#e4ddd2 1px, transparent 1px), linear-gradient(90deg, #e4ddd2 1px, transparent 1px)",
        backgroundSize: "48px 48px",
      }} />
      <div className="absolute left-[18%] top-[28%] h-3 w-3 rounded-full border-2 border-white bg-[#2563eb]" />
      <div className="absolute right-[23%] top-[38%] h-2.5 w-2.5 rounded-full border-2 border-white bg-[#2563eb]" />
      <div className="absolute bottom-[28%] left-[47%] h-3.5 w-3.5 rounded-full border-2 border-white bg-[#2563eb]" />
      <p className="absolute left-5 top-5 font-mono text-xs font-semibold tracking-[0.14em] text-cobalt-700 uppercase">
        {label}
      </p>
    </div>
  );
}

export function MapPreview() {
  const previewRef = useRef<HTMLDivElement>(null);
  const loadStartedRef = useRef(false);
  const [status, setStatus] = useState<PreviewStatus>("deferred");
  const [MerchantMap, setMerchantMap] = useState<MerchantMapComponent | null>(null);
  const [selectedPlace, setSelectedPlace] = useState<MapPlace | null>(null);

  const loadMap = useCallback(async () => {
    if (loadStartedRef.current) return;
    loadStartedRef.current = true;
    setStatus("loading");

    try {
      const mapModule = await import("@/components/map/merchant-map");
      setMerchantMap(() => mapModule.MerchantMap);
      setStatus("ready");
    } catch {
      loadStartedRef.current = false;
      setMerchantMap(null);
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    const preview = previewRef.current;
    if (!preview || status !== "deferred") return;

    if (!("IntersectionObserver" in window)) {
      const schedule =
        "requestIdleCallback" in window
          ? (callback: () => void) => {
              const id = window.requestIdleCallback(callback, { timeout: 2000 });
              return () => window.cancelIdleCallback(id);
            }
          : (callback: () => void) => {
              const id = globalThis.setTimeout(callback, 1200);
              return () => globalThis.clearTimeout(id);
            };

      return schedule(() => {
        void loadMap();
      });
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting && entry.intersectionRatio >= 0.25) {
          observer.disconnect();
          void loadMap();
        }
      },
      { threshold: [0.25] },
    );

    observer.observe(preview);
    return () => observer.disconnect();
  }, [loadMap, status]);

  const previewState = status === "deferred" ? "deferred" : "active";

  return (
    <div
      ref={previewRef}
      data-map-preview-state={previewState}
      className={`relative ${PREVIEW_HEIGHT_CLASS} flex-1 overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 shadow-xl shadow-zinc-950/5 dark:border-zinc-800 dark:bg-zinc-900`}
    >
      {status === "deferred" ? <MapPlaceholder label="Community map" /> : null}

      {status === "loading" ? (
        <div
          className="absolute inset-0 flex items-center justify-center bg-zinc-100 dark:bg-zinc-900"
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2 text-sm font-medium text-zinc-500">
            <span className="h-2 w-2 animate-pulse rounded-full bg-cobalt-600" aria-hidden="true" />
            Loading map preview…
          </div>
        </div>
      ) : null}

      {status === "error" ? (
        <div
          className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-zinc-100 px-6 text-center dark:bg-zinc-900"
          role="alert"
        >
          <p className="text-sm font-medium text-zinc-700 dark:text-zinc-200">
            Map preview could not load.
          </p>
          <button
            type="button"
            onClick={() => {
              void loadMap();
            }}
            className="inline-flex h-10 items-center justify-center rounded-lg border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 shadow-sm transition-[background-color,border-color,transform] duration-200 ease-out hover:-translate-y-px hover:border-zinc-400 hover:bg-zinc-50 active:translate-y-0 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
          >
            Try again
          </button>
        </div>
      ) : null}

      {status === "ready" && MerchantMap ? (
        <div className="absolute inset-0">
          <MerchantMap
            filters={PREVIEW_FILTERS}
            selectedPlace={selectedPlace}
            onPlaceSelect={setSelectedPlace}
          />
        </div>
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center bg-gradient-to-t from-zinc-950/55 to-transparent px-4 pb-10 pt-16 sm:justify-end sm:px-5">
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
