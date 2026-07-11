"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { MERCHANT_CATEGORIES } from "@/config/categories";

export function SubmitReportPage() {
  const [step, setStep] = useState<"search" | "create" | "report">("search");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);

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

  async function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch(
      `/api/places/search?q=${encodeURIComponent(searchQuery)}`,
    );
    const data = await res.json();
    setSearchResults(data.places ?? []);
  }

  async function handleCreatePlace(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/places", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newPlace),
    });
    const data = await res.json();
    if (data.placeId) {
      setSelectedPlaceId(data.placeId);
      setStep("report");
    } else if (data.possibleDuplicates) {
      alert("Possible duplicate found. Please select the existing place.");
      setSearchResults(data.possibleDuplicates);
      setStep("search");
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Submit a Multiplier Report</h1>
        <p className="mt-1 text-zinc-600">
          Search for an existing merchant or add a new location.
        </p>
      </div>

      <div className="flex gap-2">
        {(["search", "create"] as const).map((s) => (
          <Button
            key={s}
            variant={step === s || (step === "report" && s === "search") ? "default" : "outline"}
            size="sm"
            onClick={() => setStep(s)}
          >
            {s === "search" ? "Find Place" : "Add New Place"}
          </Button>
        ))}
      </div>

      {step === "search" && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Search Existing Places</h2>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="flex gap-2">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Merchant name or address"
                required
              />
              <Button type="submit">Search</Button>
            </form>

            {searchResults.length > 0 && (
              <ul className="mt-4 space-y-2">
                {searchResults.map((p) => (
                  <li key={p.id}>
                    <Button
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => {
                        window.location.href = `/place/${p.id}`;
                      }}
                    >
                      {p.name}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {step === "create" && (
        <Card>
          <CardHeader>
            <h2 className="font-semibold">Create New Place</h2>
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
              <Button type="submit">Create & Report</Button>
            </form>
          </CardContent>
        </Card>
      )}

      {selectedPlaceId && step === "report" && (
        <p className="text-sm text-emerald-600">
          Place created!{" "}
          <a href={`/place/${selectedPlaceId}`} className="underline">
            Go to place page to submit report
          </a>
        </p>
      )}
    </div>
  );
}
