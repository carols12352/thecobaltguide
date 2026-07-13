import { z } from "zod";
import { ACCOUNT_REPORTS_PAGE_SIZE } from "@/lib/reports/user-report-state";

export const userReportsQuerySchema = z.object({
  view: z.enum(["active", "archive"]).default("active"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(ACCOUNT_REPORTS_PAGE_SIZE),
});
