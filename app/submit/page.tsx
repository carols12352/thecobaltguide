import type { Metadata } from "next";
import { SubmitReportPage } from "@/components/reports/submit-page";

export const metadata: Metadata = {
  title: "Submit a report",
  robots: { index: false, follow: false },
};

export default function SubmitPage() {
  return (
    <div className="flex-1 bg-zinc-50 px-4 py-10 sm:px-6 sm:py-14 dark:bg-zinc-950">
      <SubmitReportPage />
    </div>
  );
}
