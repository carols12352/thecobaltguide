import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PlaceDetails } from "@/components/places/place-details";
import { Button } from "@/components/ui/button";
import { getPlacePageData } from "./place-page-data";

type PlacePageProps = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: PlacePageProps): Promise<Metadata> {
  const { id } = await params;
  const place = await getPlacePageData(id);

  if (!place) return { title: "Place not found", robots: { index: false, follow: false } };

  const location = [place.city, place.province].filter(Boolean).join(", ");
  const multiplier = place.summary?.currentMultiplier
    ? `${place.summary.currentMultiplier}× reported multiplier`
    : "community multiplier reports";
  const description = `${place.name}${location ? ` in ${location}` : ""}: ${multiplier}, recency, and confidence context.`;

  return {
    title: place.name,
    description,
    alternates: { canonical: `/place/${place.id}` },
    openGraph: { title: place.name, description, url: `/place/${place.id}` },
  };
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { id } = await params;
  const place = await getPlacePageData(id);

  if (!place) notFound();

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <Link href="/map">
        <Button variant="ghost" size="sm" className="mb-4">
          ← Back to map
        </Button>
      </Link>
      <PlaceDetails place={place} />
    </div>
  );
}
