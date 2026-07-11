export const MERCHANT_CATEGORIES = [
  { value: "grocery", label: "Grocery" },
  { value: "restaurant", label: "Restaurant & Dining" },
  { value: "fast_food", label: "Fast Food" },
  { value: "coffee", label: "Coffee & Bakery" },
  { value: "convenience", label: "Convenience Store" },
  { value: "pharmacy", label: "Pharmacy" },
  { value: "gas", label: "Gas Station" },
  { value: "retail", label: "Retail" },
  { value: "entertainment", label: "Entertainment" },
  { value: "transit", label: "Transit" },
  { value: "other", label: "Other" },
] as const;

export type MerchantCategory = (typeof MERCHANT_CATEGORIES)[number]["value"];

export const CATEGORY_VALUES = MERCHANT_CATEGORIES.map((c) => c.value);

export function getCategoryLabel(value: string): string {
  return MERCHANT_CATEGORIES.find((c) => c.value === value)?.label ?? value;
}
