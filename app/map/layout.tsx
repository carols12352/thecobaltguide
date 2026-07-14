import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Merchant Map | The Cobalt Guide",
  description: "Search and filter community-reported Cobalt merchant multipliers across Canada.",
};

export default function MapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
