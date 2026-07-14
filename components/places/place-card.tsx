import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  formatConfidence,
  formatDate,
  formatMultiplier,
  formatPlaceLocation,
} from "@/lib/utils";
import type { MapPlace } from "@/types/domain";

interface PlaceCardProps {
  place: MapPlace;
  selected?: boolean;
  onSelect?: (place: MapPlace) => void;
}

export function PlaceCard({ place, selected, onSelect }: PlaceCardProps) {
  const confidenceVariant =
    place.confidenceLevel === "high" || place.confidenceLevel === "recently_confirmed"
      ? "success"
      : place.confidenceLevel === "medium"
        ? "warning"
        : place.confidenceLevel === "disputed"
          ? "danger"
          : "muted";

  const content = (
    <Card
      className={`transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-px hover:border-zinc-300 hover:shadow-md dark:hover:border-zinc-700 ${
        selected ? "border-cobalt-400 ring-2 ring-cobalt-500/25" : ""
      } ${onSelect ? "cursor-pointer" : ""}`}
    >
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
  );

  if (onSelect) {
    return (
      <button
        type="button"
        className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cobalt-500 focus-visible:ring-offset-2"
        onClick={() => onSelect(place)}
      >
        {content}
      </button>
    );
  }

  return content;
}
