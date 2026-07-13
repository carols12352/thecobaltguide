"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { MERCHANT_CATEGORIES } from "@/config/categories";
import {
  CANADIAN_POSTAL_CODE_MESSAGE,
  formatCanadianPostalCodeInput,
} from "@/lib/validation/canadian-postal-code";
import {
  createPlaceSchema,
  geocodeQuerySchema,
} from "@/server/validation/schemas";
import type { GeocodingResult } from "@/types/domain";

function RequiredMark() {
  return (
    <span className="text-red-600" aria-hidden="true">
      *
    </span>
  );
}

const LocationPicker = dynamic(
  () =>
    import("@/components/map/location-picker").then((m) => m.LocationPicker),
  { ssr: false, loading: () => <p className="text-sm text-zinc-500">Loading map…</p> },
);

export function SubmitReportPage() {
  const [newPlace, setNewPlace] = useState({
    name: "",
    addressLine1: "",
    city: "",
    province: "ON",
    postalCode: "",
    category: "grocery",
  });
  const [coordinates, setCoordinates] = useState<{
    latitude: number;
    longitude: number;
  } | null>(null);
  const [geocodeResults, setGeocodeResults] = useState<GeocodingResult[]>([]);
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [createdPlaceId, setCreatedPlaceId] = useState<string | null>(null);

  async function handleLookupLocation(e: React.FormEvent) {
    e.preventDefault();
    setGeocodeError(null);
    setGeocodeResults([]);
    setCoordinates(null);

    const parsed = geocodeQuerySchema.safeParse(newPlace);
    if (!parsed.success) {
      const postalError = parsed.error.flatten().fieldErrors.postalCode?.[0];
      setGeocodeError(postalError ?? "Fill in all required address fields.");
      return;
    }

    setGeocodeLoading(true);

    try {
      const params = new URLSearchParams({
        addressLine1: parsed.data.addressLine1,
        city: parsed.data.city,
        province: parsed.data.province,
        postalCode: parsed.data.postalCode,
      });
      if (parsed.data.name) params.set("name", parsed.data.name);

      const res = await fetch(`/api/geocode?${params}`);
      if (!res.ok) throw new Error("Geocoding failed");

      const data = await res.json();
      const results = (data.results ?? []) as GeocodingResult[];
      if (results.length === 0) {
        setGeocodeError("No location found for this address. Check the details and try again.");
        return;
      }

      setGeocodeResults(results);
      applyGeocodeResult(results[0]);
    } catch {
      setGeocodeError("Could not look up this address. Please try again.");
    } finally {
      setGeocodeLoading(false);
    }
  }

  function applyGeocodeResult(result: GeocodingResult) {
    setCoordinates({
      latitude: result.latitude,
      longitude: result.longitude,
    });
    setNewPlace((current) => ({
      ...current,
      addressLine1: result.addressLine1 || current.addressLine1,
      city: result.city || current.city,
      province: result.province || current.province,
      postalCode: result.postalCode || current.postalCode,
    }));
  }

  async function handleCreatePlace(e: React.FormEvent) {
    e.preventDefault();
    setDuplicateMessage(null);
    setCreatedPlaceId(null);
    setSubmitError(null);

    if (!coordinates) {
      setSubmitError("Look up and confirm the location on the map before submitting.");
      return;
    }

    const parsed = createPlaceSchema.safeParse({
      ...newPlace,
      countryCode: "CA",
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });

    if (!parsed.success) {
      const fieldErrors = parsed.error.flatten().fieldErrors;
      setSubmitError(
        fieldErrors.name?.[0] ??
          fieldErrors.postalCode?.[0] ??
          "Fill in all required fields before submitting.",
      );
      return;
    }

    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(parsed.data),
    });
    const data = await res.json();

    if (!res.ok) {
      setSubmitError(data.error ?? "Could not add this merchant.");
      return;
    }

    if (data.placeId) {
      setCreatedPlaceId(data.placeId);
      return;
    }

    if (data.possibleDuplicates?.length) {
      setDuplicateMessage(
        "This merchant may already exist. Use the home page map to find it and submit a report.",
      );
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Add a New Merchant</h1>
        <p className="mt-1 text-zinc-600">
          Can&apos;t find a merchant on the{" "}
          <Link href="/" className="font-medium text-cobalt-600 hover:underline">
            home page map
          </Link>
          ? Add it here, then submit a multiplier report on its detail page.
        </p>
      </div>

      <Card>
        <CardHeader>
          <h2 className="font-semibold">New Place Details</h2>
        </CardHeader>
        <CardContent className="space-y-6">
          <form onSubmit={handleLookupLocation} className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="place-name">Merchant name</Label>
              <Input
                id="place-name"
                placeholder="e.g. Walmart Supercenter"
                value={newPlace.name}
                onChange={(e) =>
                  setNewPlace({ ...newPlace, name: e.target.value })
                }
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="place-address">
                Address <RequiredMark />
              </Label>
              <Input
                id="place-address"
                placeholder="Street address"
                value={newPlace.addressLine1}
                onChange={(e) =>
                  setNewPlace({ ...newPlace, addressLine1: e.target.value })
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label htmlFor="place-city">
                  City <RequiredMark />
                </Label>
                <Input
                  id="place-city"
                  placeholder="City"
                  value={newPlace.city}
                  onChange={(e) =>
                    setNewPlace({ ...newPlace, city: e.target.value })
                  }
                  required
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="place-province">
                  Province <RequiredMark />
                </Label>
                <Input
                  id="place-province"
                  placeholder="ON"
                  value={newPlace.province}
                  onChange={(e) =>
                    setNewPlace({ ...newPlace, province: e.target.value })
                  }
                  required
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="place-postal">
                Postal code <RequiredMark />
              </Label>
              <Input
                id="place-postal"
                placeholder="A1A 1A1"
                value={newPlace.postalCode}
                onChange={(e) =>
                  setNewPlace({
                    ...newPlace,
                    postalCode: formatCanadianPostalCodeInput(e.target.value),
                  })
                }
                required
                maxLength={7}
                autoComplete="postal-code"
                spellCheck={false}
                aria-describedby="place-postal-hint"
              />
              <p id="place-postal-hint" className="text-xs text-zinc-500">
                {CANADIAN_POSTAL_CODE_MESSAGE}. Only valid characters are accepted.
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="place-category">
                Category <RequiredMark />
              </Label>
              <Select
                id="place-category"
                value={newPlace.category}
                onChange={(e) =>
                  setNewPlace({ ...newPlace, category: e.target.value })
                }
                required
              >
                {MERCHANT_CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit" variant="outline" disabled={geocodeLoading}>
              {geocodeLoading ? "Looking up…" : "Look up location"}
            </Button>
            {geocodeError && (
              <p className="text-sm text-red-600">{geocodeError}</p>
            )}
          </form>

          {geocodeResults.length > 1 && (
            <div className="space-y-2">
              <p className="text-sm font-medium text-zinc-700">
                Multiple matches found — pick the correct one:
              </p>
              <div className="space-y-2">
                {geocodeResults.map((result) => (
                  <button
                    key={result.externalPlaceId}
                    type="button"
                    className="w-full rounded-lg border border-zinc-200 px-3 py-2 text-left text-sm hover:border-cobalt-500 dark:border-zinc-700"
                    onClick={() => applyGeocodeResult(result)}
                  >
                    {result.addressLine1}, {result.city}, {result.province}{" "}
                    {result.postalCode}
                  </button>
                ))}
              </div>
            </div>
          )}

          {coordinates && (
            <div className="space-y-3">
              <p className="text-sm font-medium text-zinc-700">
                Confirm location on map
              </p>
              <LocationPicker
                latitude={coordinates.latitude}
                longitude={coordinates.longitude}
                onChange={(latitude, longitude) =>
                  setCoordinates({ latitude, longitude })
                }
              />
              <form onSubmit={handleCreatePlace}>
                <Button type="submit">Add Place</Button>
              </form>
            </div>
          )}

          {submitError && (
            <p className="text-sm text-red-600">{submitError}</p>
          )}

          {duplicateMessage && (
            <p className="text-sm text-amber-700">{duplicateMessage}</p>
          )}

          {createdPlaceId && (
            <p className="text-sm text-emerald-600">
              Place added!{" "}
              <Link
                href={`/place/${createdPlaceId}`}
                className="font-medium underline"
              >
                Expand details to submit a report
              </Link>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
