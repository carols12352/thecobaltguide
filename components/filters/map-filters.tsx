"use client";

import { MERCHANT_CATEGORIES } from "@/config/categories";
import { MULTIPLIER_OPTIONS } from "@/config/constants";
import { Select } from "@/components/ui/select";

export interface MapFilters {
  multiplier: string;
  category: string;
}

interface MapFiltersProps {
  filters: MapFilters;
  onChange: (filters: MapFilters) => void;
}

export function MapFiltersBar({ filters, onChange }: MapFiltersProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Multiplier</label>
        <Select
          value={filters.multiplier}
          onChange={(e) =>
            onChange({ ...filters, multiplier: e.target.value })
          }
        >
          <option value="">All</option>
          {MULTIPLIER_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}x
            </option>
          ))}
        </Select>
      </div>

      <div className="flex flex-col gap-1">
        <label className="text-xs font-medium text-zinc-500">Category</label>
        <Select
          value={filters.category}
          onChange={(e) =>
            onChange({ ...filters, category: e.target.value })
          }
        >
          <option value="">All</option>
          {MERCHANT_CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </Select>
      </div>
    </div>
  );
}
