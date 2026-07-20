import Link from "next/link";
import { EmptyState } from "@/components/admin/admin-dashboard-parts";
import { placeStatusVariant, type AdminPlace } from "@/components/admin/admin-dashboard-model";
import { PlacesPagination, PLACES_PAGE_SIZE } from "@/components/admin/places-pagination";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { getCategoryLabel } from "@/config/categories";
import type { PlaceSearchCriteria } from "@/lib/admin/place-search";
import { formatCanadianPostalCodeInput } from "@/lib/validation/canadian-postal-code";

export interface PlaceSearchInputs {
  name: string;
  postalCode: string;
  addressLine1: string;
}

export interface MergePlaceInputs {
  sourceId: string;
  targetId: string;
  reason: string;
}

export function PlacesTab({
  places,
  total,
  page,
  loading,
  searchInputs,
  searchCriteria,
  searchError,
  filter,
  mergeInputs,
  merging,
  onSearchInputsChange,
  onSubmitSearch,
  onFilterChange,
  onPageChange,
  onPatchPlace,
  onMergeInputsChange,
  onSubmitMerge,
}: {
  places: AdminPlace[];
  total: number;
  page: number;
  loading: boolean;
  searchInputs: PlaceSearchInputs;
  searchCriteria: PlaceSearchCriteria | null;
  searchError: string | null;
  filter: string;
  mergeInputs: MergePlaceInputs;
  merging: boolean;
  onSearchInputsChange: (inputs: PlaceSearchInputs) => void;
  onSubmitSearch: (event: React.FormEvent) => void;
  onFilterChange: (value: string) => void;
  onPageChange: (page: number) => void;
  onPatchPlace: (id: string, updates: Record<string, unknown>) => void;
  onMergeInputsChange: (inputs: MergePlaceInputs) => void;
  onSubmitMerge: (event: React.FormEvent) => void;
}) {
  return (
    <section id="admin-panel-places" role="tabpanel" aria-labelledby="admin-tab-places" className="space-y-6">
      <form onSubmit={onSubmitSearch} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="space-y-1 sm:col-span-2 lg:col-span-1">
          <Label htmlFor="place-search-name">Merchant name</Label>
          <Input id="place-search-name" value={searchInputs.name} onChange={(event) => onSearchInputsChange({ ...searchInputs, name: event.target.value })} placeholder="Name or place UUID" spellCheck={false} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="place-search-postal">Postal code</Label>
          <Input id="place-search-postal" value={searchInputs.postalCode} onChange={(event) => onSearchInputsChange({ ...searchInputs, postalCode: formatCanadianPostalCodeInput(event.target.value) })} placeholder="A1A 1A1" maxLength={7} spellCheck={false} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="place-search-address">Address</Label>
          <Input id="place-search-address" value={searchInputs.addressLine1} onChange={(event) => onSearchInputsChange({ ...searchInputs, addressLine1: event.target.value })} placeholder="Street address" spellCheck={false} />
        </div>
        <div className="flex items-end sm:col-span-2 lg:col-span-4">
          <Button type="submit" disabled={loading}>{loading ? "Searching…" : "Look up"}</Button>
        </div>
        {searchError ? <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-4">{searchError}</p> : <p className="text-xs text-zinc-500 sm:col-span-2 lg:col-span-4">Fill in one or more fields. Multiple fields narrow the search.</p>}
      </form>

      <div className="flex flex-wrap items-center gap-3">
        <Label htmlFor="place-filter">Filter</Label>
        <Select id="place-filter" value={filter} onChange={(event) => onFilterChange(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="permanently_closed">Permanently closed</option>
          <option value="merged">Merged</option>
        </Select>
      </div>

      {total > 0 ? <PlacesPagination page={page} total={total} loading={loading} onPageChange={onPageChange} /> : null}
      <div className="space-y-3">
        {places.map((place) => (
          <Card key={place.id} className="shadow-none transition-colors duration-200 hover:border-zinc-300 dark:hover:border-zinc-700">
            <CardContent className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium">{place.name}</p>
                  <Badge variant={placeStatusVariant(place.status)}>{place.status.replaceAll("_", " ")}</Badge>
                </div>
                {place.address_line1 ? <p className="text-sm text-zinc-600">{place.address_line1}</p> : null}
                <p className="text-sm text-zinc-600">{place.city}, {place.province}{place.postal_code ? ` · ${place.postal_code}` : ""} · {getCategoryLabel(place.category)}</p>
                <p className="font-mono text-xs text-zinc-500">{place.id}</p>
                <Link href={`/admin/places/${place.id}`} className="text-sm font-medium text-cobalt-600 hover:underline">Open place →</Link>
              </div>
              <div className="flex flex-wrap gap-2">
                {place.status !== "active" ? <Button size="sm" variant="outline" onClick={() => onPatchPlace(place.id, { status: "active" })}>Mark active</Button> : null}
                {place.status !== "permanently_closed" ? <Button size="sm" variant="destructive" onClick={() => onPatchPlace(place.id, { status: "permanently_closed" })}>Mark closed</Button> : null}
              </div>
            </CardContent>
          </Card>
        ))}
        {places.length === 0 && !loading ? <EmptyState message={searchCriteria ? "No places match this search." : "Enter a merchant name, postal code, or address to look up places."} /> : null}
        {loading && places.length === 0 ? <p className="text-sm text-zinc-600">Loading places…</p> : null}
      </div>
      {total > PLACES_PAGE_SIZE ? <PlacesPagination page={page} total={total} loading={loading} onPageChange={onPageChange} /> : null}

      <Card>
        <CardHeader>
          <h2 className="font-semibold">Merge duplicate places</h2>
          <p className="text-sm text-zinc-600">Moves reports from the source place to the target, then marks the source as merged.</p>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmitMerge} className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="merge-source">Source place ID</Label>
                <Input id="merge-source" value={mergeInputs.sourceId} onChange={(event) => onMergeInputsChange({ ...mergeInputs, sourceId: event.target.value })} placeholder="Duplicate to remove" required />
              </div>
              <div className="space-y-1">
                <Label htmlFor="merge-target">Target place ID</Label>
                <Input id="merge-target" value={mergeInputs.targetId} onChange={(event) => onMergeInputsChange({ ...mergeInputs, targetId: event.target.value })} placeholder="Place to keep" required />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="merge-reason">Reason (optional)</Label>
              <Input id="merge-reason" value={mergeInputs.reason} onChange={(event) => onMergeInputsChange({ ...mergeInputs, reason: event.target.value })} placeholder="Duplicate listing" />
            </div>
            <Button type="submit" disabled={merging}>{merging ? "Merging…" : "Merge places"}</Button>
          </form>
        </CardContent>
      </Card>
    </section>
  );
}
