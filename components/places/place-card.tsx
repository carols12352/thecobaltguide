import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatConfidence,
  formatDate,
  formatMultiplier,
  formatPlaceLocation,
} from "@/lib/utils";
import type { MapPlace } from "@/types/domain";

export function PlaceCard({ place }: { place: MapPlace }) {
  const confidenceVariant =
    place.confidenceLevel === "high" || place.confidenceLevel === "recently_confirmed"
      ? "success"
      : place.confidenceLevel === "medium"
        ? "warning"
        : place.confidenceLevel === "disputed"
          ? "danger"
          : "muted";

  return (
    <Link href={`/place/${place.id}`}>
      <Card className="transition-shadow hover:shadow-md">
        <CardContent className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <h3 className="truncate font-medium">{place.name}</h3>
            <p className="truncate text-sm text-zinc-500">
              {formatPlaceLocation(place)}
            </p>
            <p className="text-sm text-zinc-500">
              {place.recentReportCount} recent reports · Last{" "}
              {formatDate(place.lastReportedAt)}
            </p>
          </div>
          <div className="flex shrink-0 flex-col items-end gap-1">
            <Badge variant="default">
              {formatMultiplier(place.multiplier)}
            </Badge>
            <Badge variant={confidenceVariant}>
              {formatConfidence(place.confidenceLevel)}
            </Badge>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
