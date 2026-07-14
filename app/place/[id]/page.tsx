import Link from "next/link";
import { notFound } from "next/navigation";
import { PlaceDetails } from "@/components/places/place-details";
import { Button } from "@/components/ui/button";
import { placeService } from "@/server/services/place-service";

export default async function PlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const place = await placeService.getPlaceById(id);

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
