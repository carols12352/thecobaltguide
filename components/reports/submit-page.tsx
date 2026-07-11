"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MERCHANT_CATEGORIES } from "@/config/categories";

export function SubmitReportPage() {
  const [newPlace, setNewPlace] = useState({
    name: "",
    addressLine1: "",
    city: "",
    province: "ON",
    postalCode: "",
    latitude: 43.6532,
    longitude: -79.3832,
    category: "grocery",
  });
  const [duplicateMessage, setDuplicateMessage] = useState<string | null>(null);
  const [createdPlaceId, setCreatedPlaceId] = useState<string | null>(null);

  async function handleCreatePlace(e: React.FormEvent) {
    e.preventDefault();
    setDuplicateMessage(null);
    setCreatedPlaceId(null);

    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlace),
    });
    const data = await res.json();

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
        <CardContent>
          <form onSubmit={handleCreatePlace} className="space-y-3">
            <Input
              placeholder="Merchant name"
              value={newPlace.name}
              onChange={(e) =>
                setNewPlace({ ...newPlace, name: e.target.value })
              }
              required
            />
            <Input
              placeholder="Address"
              value={newPlace.addressLine1}
              onChange={(e) =>
                setNewPlace({ ...newPlace, addressLine1: e.target.value })
              }
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <Input
                placeholder="City"
                value={newPlace.city}
                onChange={(e) =>
                  setNewPlace({ ...newPlace, city: e.target.value })
                }
                required
              />
              <Input
                placeholder="Province"
                value={newPlace.province}
                onChange={(e) =>
                  setNewPlace({ ...newPlace, province: e.target.value })
                }
                required
              />
            </div>
            <Input
              placeholder="Postal code"
              value={newPlace.postalCode}
              onChange={(e) =>
                setNewPlace({ ...newPlace, postalCode: e.target.value })
              }
              required
            />
            <Select
              value={newPlace.category}
              onChange={(e) =>
                setNewPlace({ ...newPlace, category: e.target.value })
              }
            >
              {MERCHANT_CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </Select>
            <Button type="submit">Add Place</Button>
          </form>

          {duplicateMessage && (
            <p className="mt-4 text-sm text-amber-700">{duplicateMessage}</p>
          )}

          {createdPlaceId && (
            <p className="mt-4 text-sm text-emerald-600">
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
