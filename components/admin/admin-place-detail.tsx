"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { CONFIDENCE_LEVELS, MULTIPLIER_OPTIONS } from "@/config/constants";
import { getCategoryLabel } from "@/config/categories";
import {
  formatConfidence,
  formatDate,
  formatMultiplier,
  formatPlaceAddress,
} from "@/lib/utils";
import { formatCanadianPostalCodeInput } from "@/lib/validation/canadian-postal-code";
import type { GeocodeMatchTier } from "@/lib/geocoding/address-query";
import {
  fetchGeocodeLookup,
  fetchReverseGeocode,
  enrichGeocodeResultWithReverse,
  geocodeParamsFromForm,
  geocodeSuccessMessage,
  mergeGeocodeLookupIntoAddressFields,
  mergeReverseGeocodeIntoAddressFields,
  resolveGeocodeAddressLine1,
  formatGeocodeResultLabel,
} from "@/lib/geocoding/client";
import { geocodeQuerySchema } from "@/server/validation/schemas";
import type { z } from "zod";
import type {
  AdminPlaceDetail,
  AdminPlaceFlag,
  ConfidenceLevel,
  GeocodingResult,
  MultiplierValue,
} from "@/types/domain";

type GeocodeLookupInput = z.infer<typeof geocodeQuerySchema>;

const LocationPicker = dynamic(
  () =>
    import("@/components/map/location-picker").then((m) => m.LocationPicker),
  {
    ssr: false,
    loading: () => <p className="text-sm text-zinc-500">Loading map…</p>,
  },
);

const GEOCODE_LOOKUP_HINT =
  "Look up by postal code, street address, or merchant name + city — priority in that order. At least one is required. Multiple matches are shown for you to pick from; the best match is applied automatically. Empty or incorrect fields are filled from the result; correctly entered values are kept. Drag the pin to fine-tune.";

const GEOCODE_MATCH_TIER_LABELS: Record<GeocodeMatchTier, string> = {
  postal: "Postal",
  address: "Address",
  name: "Name + city",
};

const FLAG_REASON_LABELS: Record<string, string> = {
  duplicate: "Duplicate",
  wrong_address: "Wrong address",
  permanently_closed: "Permanently closed",
  does_not_accept_amex: "Does not accept Amex",
  incorrect_category: "Incorrect category",
  other: "Other",
};

type AddressForm = {
  addressLine1: string;
  city: string;
  province: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

function toAddressForm(place: AdminPlaceDetail): AddressForm {
  return {
    addressLine1: place.addressLine1,
    city: place.city,
    province: place.province,
    postalCode: place.postalCode,
    latitude: place.latitude,
    longitude: place.longitude,
  };
}

function addressChanged(place: AdminPlaceDetail, form: AddressForm): boolean {
  return (
    place.addressLine1 !== form.addressLine1 ||
    place.city !== form.city ||
    place.province !== form.province ||
    place.postalCode !== form.postalCode ||
    Math.abs(place.latitude - form.latitude) > 1e-6 ||
    Math.abs(place.longitude - form.longitude) > 1e-6
  );
}

export function AdminPlaceDetailView({ placeId }: { placeId: string }) {
  const [place, setPlace] = useState<AdminPlaceDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [savingAddress, setSavingAddress] = useState(false);
  const [addressForm, setAddressForm] = useState<AddressForm | null>(null);
  const [geocodeName, setGeocodeName] = useState("");
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [pinGeocodeLoading, setPinGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [geocodeNotice, setGeocodeNotice] = useState<string | null>(null);
  const pinGeocodeRequestRef = useRef(0);
  const lastLookupInputRef = useRef<GeocodeLookupInput | null>(null);
  const [resolvePromptOpen, setResolvePromptOpen] = useState(false);
  const [resolvePromptCount, setResolvePromptCount] = useState(0);
  const [resolvingFlags, setResolvingFlags] = useState(false);
  const [confidenceLevel, setConfidenceLevel] =
    useState<ConfidenceLevel>("insufficient");
  const [currentMultiplier, setCurrentMultiplier] = useState<string>("");

  const loadPlace = useCallback(async () => {
    setLoading(true);
    setError(null);

    const res = await fetch(`/api/admin/places/${placeId}`);
    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setError(data?.error ?? "Failed to load place.");
      setLoading(false);
      return;
    }

    const data = await res.json();
    const loaded = data.place as AdminPlaceDetail;
    setPlace(loaded);
    setAddressForm(toAddressForm(loaded));
    setGeocodeName(loaded.name);
    setGeocodeResults([]);
    setGeocodeError(null);
    setGeocodeNotice(null);
    setConfidenceLevel(loaded.summary?.confidenceLevel ?? "insufficient");
    setCurrentMultiplier(
      loaded.summary?.currentMultiplier
        ? String(loaded.summary.currentMultiplier)
        : "",
    );
    setLoading(false);
  }, [placeId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadPlace(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadPlace]);

  async function lookupAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!place || !addressForm) return;

    setGeocodeError(null);
    setGeocodeNotice(null);
    setGeocodeResults([]);

    const lookupInput = geocodeParamsFromForm({
      name: geocodeName,
      addressLine1: addressForm.addressLine1,
      city: addressForm.city,
      province: addressForm.province,
      postalCode: addressForm.postalCode,
    });
    const parsed = geocodeQuerySchema.safeParse(lookupInput);

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setGeocodeError(
        fieldErrors.postalCode?.[0] ??
          fieldErrors.name?.[0] ??
          fieldErrors.addressLine1?.[0] ??
          "Enter a merchant name, postal code, or address to look up the location.",
      );
      return;
    }

    setGeocodeLoading(true);
    try {
      const { results, source } = await fetchGeocodeLookup(parsed.data);
      if (results.length === 0) {
        setGeocodeError(
          "No matching location found. Check the name, postal code, or address and try again.",
        );
        return;
      }

      setGeocodeResults(results.length > 1 ? results : []);
      lastLookupInputRef.current = parsed.data;
      const enriched = await enrichGeocodeResultWithReverse(results[0]!);
      mergeGeocodeResult(enriched, parsed.data);
      setGeocodeNotice(
        results.length > 1
          ? `${results.length} street matches found — pick the correct one if needed.`
          : geocodeSuccessMessage(source, enriched),
      );
    } catch {
      setGeocodeError("Could not look up that address.");
    } finally {
      setGeocodeLoading(false);
    }
  }

  function mergeGeocodeResult(
    result: GeocodingResult,
    lookup: GeocodeLookupInput = lastLookupInputRef.current ?? {},
  ) {
    setAddressForm((current) =>
      current
        ? mergeGeocodeLookupIntoAddressFields(current, result, lookup)
        : current,
    );
    setGeocodeError(null);
  }

  function pickGeocodeResult(result: GeocodingResult) {
    mergeGeocodeResult(result);
    setGeocodeResults([]);
    const street = resolveGeocodeAddressLine1(result);
    setGeocodeNotice(
      street
        ? `Address updated to ${street}. Drag the pin if needed.`
        : "Location updated. Drag the pin if needed.",
    );
  }

  async function handlePinChange(latitude: number, longitude: number) {
    const requestId = ++pinGeocodeRequestRef.current;

    setAddressForm((current) =>
      current ? { ...current, latitude, longitude } : current,
    );
    setPinGeocodeLoading(true);
    setGeocodeError(null);
    setGeocodeResults([]);

    try {
      const results = await fetchReverseGeocode(latitude, longitude);
      if (requestId !== pinGeocodeRequestRef.current) return;

      if (results.length === 0) {
        setGeocodeNotice("Pin moved. No street address found at this location.");
        return;
      }

      const result = results[0]!;
      setAddressForm((current) =>
        current
          ? mergeReverseGeocodeIntoAddressFields(
              { ...current, latitude, longitude },
              result,
            )
          : current,
      );

      const street = resolveGeocodeAddressLine1(result);
      setGeocodeNotice(
        street
          ? `Pin moved. Address updated to ${street}.`
          : "Pin moved. City and postal code updated from map location.",
      );
    } catch {
      if (requestId === pinGeocodeRequestRef.current) {
        setGeocodeNotice("Pin moved. Could not look up address for this location.");
      }
    } finally {
      if (requestId === pinGeocodeRequestRef.current) {
        setPinGeocodeLoading(false);
      }
    }
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    if (!place || !addressForm) return;

    setSaveError(null);
    setSavingAddress(true);

    const res = await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        addressLine1: addressForm.addressLine1,
        city: addressForm.city,
        province: addressForm.province,
        postalCode: addressForm.postalCode,
        latitude: addressForm.latitude,
        longitude: addressForm.longitude,
      }),
    });

    setSavingAddress(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not save address.");
      return;
    }

    const data = await res.json();
    const updated = data.place as AdminPlaceDetail;
    setPlace(updated);
    setAddressForm(toAddressForm(updated));

    if (updated.openFlagCount > 0) {
      setResolvePromptCount(updated.openFlagCount);
      setResolvePromptOpen(true);
    }
  }

  async function resolveOpenFlags(status: "resolved" | "dismissed") {
    setResolvingFlags(true);
    setSaveError(null);

    const res = await fetch(`/api/admin/places/${placeId}/flags`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    setResolvingFlags(false);
    setResolvePromptOpen(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not update flags.");
      return;
    }

    const data = await res.json();
    if (data.place) {
      setPlace(data.place as AdminPlaceDetail);
    } else {
      await loadPlace();
    }
  }

  async function saveSummary(e: React.FormEvent) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const res = await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        summary: {
          confidenceLevel,
          ...(currentMultiplier
            ? { currentMultiplier: Number(currentMultiplier) }
            : {}),
        },
      }),
    });

    setSaving(false);

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not save summary.");
      return;
    }

    const data = await res.json();
    setPlace(data.place as AdminPlaceDetail);
  }

  async function updateStatus(status: AdminPlaceDetail["status"]) {
    setSaveError(null);
    const res = await fetch(`/api/admin/places/${placeId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });

    if (!res.ok) {
      const data = await res.json().catch(() => null);
      setSaveError(data?.error ?? "Could not update place status.");
      return;
    }

    const data = await res.json();
    setPlace(data.place as AdminPlaceDetail);
  }

  if (loading) {
    return (
      <AdminPlaceShell>
        <p className="text-sm text-zinc-500">Loading place…</p>
      </AdminPlaceShell>
    );
  }

  if (error || !place || !addressForm) {
    return (
      <AdminPlaceShell>
        <p className="text-red-600">{error ?? "Place not found."}</p>
        <Link href="/admin">
          <Button variant="outline" className="mt-4">
            Back to dashboard
          </Button>
        </Link>
      </AdminPlaceShell>
    );
  }

  const mapsUrl = `https://www.google.com/maps?q=${addressForm.latitude},${addressForm.longitude}`;
  const addressDirty = addressChanged(place, addressForm);
  const openFlags = place.flags.filter((flag) => flag.status === "open");
  const reviewedFlags = place.flags.filter((flag) => flag.status !== "open");

  return (
    <AdminPlaceShell>
      <div className="shrink-0 space-y-4 border-b border-zinc-200 pb-4 dark:border-zinc-800">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <Link
              href="/admin"
              className="text-sm font-medium text-cobalt-600 hover:underline"
            >
              ← Admin dashboard
            </Link>
            <h1 className="mt-4 text-2xl font-bold">{place.name}</h1>
            <p className="mt-1 text-zinc-600 dark:text-zinc-400">
              {formatPlaceAddress(place)}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <Badge variant="muted">{getCategoryLabel(place.category)}</Badge>
              <Badge
                variant={place.status === "active" ? "success" : "warning"}
              >
                {place.status.replaceAll("_", " ")}
              </Badge>
              {place.openFlagCount > 0 ? (
                <Badge variant="warning">
                  {place.openFlagCount} open flag
                  {place.openFlagCount === 1 ? "" : "s"}
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href={`/place/${place.id}`} target="_blank">
              <Button variant="outline" size="sm">
                Public page
              </Button>
            </Link>
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer">
              <Button variant="outline" size="sm">
                Open in Maps
              </Button>
            </a>
          </div>
        </div>
        {saveError ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {saveError}
          </p>
        ) : null}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-4">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <h2 className="font-semibold">Address & location</h2>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {GEOCODE_LOOKUP_HINT}
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={(e) => void lookupAddress(e)} className="grid gap-3">
                <div className="space-y-1">
                  <Label htmlFor="geocode-name">Merchant name</Label>
                  <Input
                    id="geocode-name"
                    value={geocodeName}
                    onChange={(e) => setGeocodeName(e.target.value)}
                    placeholder="Business name for geocoding"
                    spellCheck={false}
                  />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address-line1">Address line 1</Label>
                  <Input
                    id="address-line1"
                    value={addressForm.addressLine1}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        addressLine1: e.target.value,
                      })
                    }
                  />
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <Label htmlFor="address-city">City</Label>
                    <Input
                      id="address-city"
                      value={addressForm.city}
                      onChange={(e) =>
                        setAddressForm({ ...addressForm, city: e.target.value })
                      }
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="address-province">Province</Label>
                    <Input
                      id="address-province"
                      value={addressForm.province}
                      onChange={(e) =>
                        setAddressForm({
                          ...addressForm,
                          province: e.target.value,
                        })
                      }
                    />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label htmlFor="address-postal">Postal code</Label>
                  <Input
                    id="address-postal"
                    value={addressForm.postalCode}
                    onChange={(e) =>
                      setAddressForm({
                        ...addressForm,
                        postalCode: formatCanadianPostalCodeInput(e.target.value),
                      })
                    }
                    maxLength={7}
                  />
                </div>
                <Button type="submit" variant="outline" disabled={geocodeLoading}>
                  {geocodeLoading ? "Looking up…" : "Look up location"}
                </Button>
                {geocodeError ? (
                  <p className="text-sm text-red-600">{geocodeError}</p>
                ) : null}
                {geocodeNotice ? (
                  <p className="text-sm text-emerald-700 dark:text-emerald-300">
                    {geocodeNotice}
                  </p>
                ) : null}
              </form>

              {geocodeResults.length > 1 ? (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                    Multiple matches — pick the correct one:
                  </p>
                  <div className="space-y-2">
                    {geocodeResults.map((result) => (
                      <button
                        key={result.externalPlaceId}
                        type="button"
                        className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-cobalt-500 dark:border-zinc-700"
                        onClick={() => pickGeocodeResult(result)}
                      >
                        {result.matchTier ? (
                          <span className="mb-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            {GEOCODE_MATCH_TIER_LABELS[result.matchTier]}
                          </span>
                        ) : null}
                        {formatGeocodeResultLabel(result)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <dl className="grid grid-cols-2 gap-3 text-sm">
                <MetadataItem
                  label="Latitude"
                  value={addressForm.latitude.toFixed(6)}
                />
                <MetadataItem
                  label="Longitude"
                  value={addressForm.longitude.toFixed(6)}
                />
              </dl>

              <LocationPicker
                latitude={addressForm.latitude}
                longitude={addressForm.longitude}
                onChange={(latitude, longitude) => void handlePinChange(latitude, longitude)}
              />
              {pinGeocodeLoading ? (
                <p className="text-xs text-zinc-500">Looking up address for pin location…</p>
              ) : null}

              <form onSubmit={(e) => void saveAddress(e)}>
                <Button type="submit" disabled={savingAddress || !addressDirty}>
                  {savingAddress ? "Saving…" : "Save address"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="font-semibold">Flags</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Community reports that need moderator review for this place.
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                {openFlags.length > 0 ? (
                  openFlags.map((flag) => (
                    <FlagReviewCard key={flag.id} flag={flag} />
                  ))
                ) : (
                  <p className="text-sm text-zinc-500">No open flags.</p>
                )}

                {reviewedFlags.length > 0 ? (
                  <div className="space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-800">
                    <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">
                      Review history
                    </p>
                    {reviewedFlags.map((flag) => (
                      <FlagReviewCard key={flag.id} flag={flag} />
                    ))}
                  </div>
                ) : null}

                {openFlags.length > 0 ? (
                  <div className="flex flex-wrap gap-2 pt-2">
                    <Button
                      size="sm"
                      disabled={resolvingFlags}
                      onClick={() => void resolveOpenFlags("resolved")}
                    >
                      Mark all resolved
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={resolvingFlags}
                      onClick={() => void resolveOpenFlags("dismissed")}
                    >
                      Dismiss all
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="font-semibold">Internal metadata</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                  Moderator-only identifiers and audit fields.
                </p>
              </CardHeader>
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <MetadataItem label="Place ID" value={place.id} mono />
                  <MetadataItem
                    label="Normalized name"
                    value={place.normalizedName}
                    mono
                  />
                  <MetadataItem
                    label="External place ID"
                    value={place.externalPlaceId ?? "—"}
                    mono
                  />
                  <MetadataItem
                    label="Created by"
                    value={
                      place.createdByUsername
                        ? `${place.createdByUsername} (${place.createdBy})`
                        : (place.createdBy ?? "—")
                    }
                    mono={Boolean(place.createdBy)}
                  />
                  <MetadataItem label="Created" value={formatDate(place.createdAt)} />
                  <MetadataItem label="Updated" value={formatDate(place.updatedAt)} />
                  <MetadataItem label="Brand" value={place.brandName ?? "—"} />
                  <MetadataItem
                    label="Accepts Amex"
                    value={
                      place.acceptsAmex == null
                        ? "Unknown"
                        : place.acceptsAmex
                          ? "Yes"
                          : "No"
                    }
                  />
                </dl>
              </CardContent>
            </Card>
          </div>
        </div>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Multiplier summary</h2>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Override the public confidence badge and displayed multiplier. The
              score shown below is computed automatically from the level you
              pick. New community reports may recalculate both unless you adjust
              again.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {place.summary ? (
              <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <MetadataItem
                  label="Confidence score"
                  value={
                    place.summary.confidenceScore != null
                      ? place.summary.confidenceScore.toFixed(2)
                      : "—"
                  }
                />
                <MetadataItem
                  label="Recent reports"
                  value={String(place.summary.recentReportCount)}
                />
                <MetadataItem
                  label="Unique reporters"
                  value={String(place.summary.uniqueReporterCount)}
                />
                <MetadataItem
                  label="Last reported"
                  value={formatDate(place.summary.lastReportedAt)}
                />
                <MetadataItem
                  label="Score totals"
                  value={`1x ${place.summary.score1x.toFixed(1)} · 2x ${place.summary.score2x.toFixed(1)} · 3x ${place.summary.score3x.toFixed(1)} · 5x ${place.summary.score5x.toFixed(1)}`}
                />
              </dl>
            ) : (
              <p className="text-sm text-zinc-500">No summary row yet — save to create one.</p>
            )}

            <form onSubmit={(e) => void saveSummary(e)} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <Label htmlFor="confidence-level">Confidence level</Label>
                <Select
                  id="confidence-level"
                  value={confidenceLevel}
                  onChange={(e) =>
                    setConfidenceLevel(e.target.value as ConfidenceLevel)
                  }
                >
                  {CONFIDENCE_LEVELS.map((level) => (
                    <option key={level} value={level}>
                      {formatConfidence(level)}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-zinc-500">
                  This is what users see on the map and place pages.
                </p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="current-multiplier">Current multiplier</Label>
                <Select
                  id="current-multiplier"
                  value={currentMultiplier}
                  onChange={(e) => setCurrentMultiplier(e.target.value)}
                >
                  <option value="">None</option>
                  {MULTIPLIER_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {formatMultiplier(value as MultiplierValue)}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="sm:col-span-2">
                <Button type="submit" disabled={saving}>
                  {saving ? "Saving…" : "Save summary overrides"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="mt-6">
          <CardHeader>
            <h2 className="font-semibold">Place status</h2>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {place.status !== "active" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void updateStatus("active")}
              >
                Mark active
              </Button>
            ) : null}
            {place.status !== "permanently_closed" ? (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => void updateStatus("permanently_closed")}
              >
                Mark permanently closed
              </Button>
            ) : null}
          </CardContent>
        </Card>
      </div>

      <Dialog
        open={resolvePromptOpen}
        onClose={() => setResolvePromptOpen(false)}
        title="Mark flags resolved?"
      >
        <p>
          Address saved. Do you want to mark{" "}
          <strong>
            {resolvePromptCount} open flag
            {resolvePromptCount === 1 ? "" : "s"}
          </strong>{" "}
          as resolved? Your moderator name will be recorded as the reviewer.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            type="button"
            variant="outline"
            disabled={resolvingFlags}
            onClick={() => setResolvePromptOpen(false)}
          >
            Not now
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={resolvingFlags}
            onClick={() => void resolveOpenFlags("dismissed")}
          >
            Dismiss instead
          </Button>
          <Button
            type="button"
            disabled={resolvingFlags}
            onClick={() => void resolveOpenFlags("resolved")}
          >
            {resolvingFlags ? "Saving…" : "Mark resolved"}
          </Button>
        </div>
      </Dialog>
    </AdminPlaceShell>
  );
}

function FlagReviewCard({ flag }: { flag: AdminPlaceFlag }) {
  const statusLabel =
    flag.status === "open"
      ? "Open"
      : flag.status === "resolved"
        ? "Resolved"
        : "Dismissed";

  return (
    <div className="rounded-lg border border-zinc-200 px-3 py-2 dark:border-zinc-700">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-medium">
          {FLAG_REASON_LABELS[flag.reason] ?? flag.reason}
        </p>
        <Badge variant={flag.status === "open" ? "warning" : "muted"}>
          {statusLabel}
        </Badge>
      </div>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Flagged by {flag.reporterUsername ?? "unknown"} ·{" "}
        {formatDate(flag.createdAt)}
      </p>
      {flag.details ? (
        <p className="mt-2 text-sm text-zinc-700 dark:text-zinc-300">
          {flag.details}
        </p>
      ) : null}
      {flag.reviewedByUsername && flag.resolvedAt ? (
        <p className="mt-2 text-sm font-medium text-emerald-700 dark:text-emerald-300">
          Reviewed by {flag.reviewedByUsername} · {formatDate(flag.resolvedAt)}
        </p>
      ) : null}
    </div>
  );
}

function AdminPlaceShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-6xl flex-col overflow-hidden px-4 sm:px-6">
      {children}
    </div>
  );
}

function MetadataItem({
  label,
  value,
  mono = false,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div>
      <dt className="text-zinc-500">{label}</dt>
      <dd className={mono ? "font-mono text-xs break-all" : "font-medium"}>
        {value}
      </dd>
    </div>
  );
}
