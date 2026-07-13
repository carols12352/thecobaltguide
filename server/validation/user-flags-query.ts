import { z } from "zod";
import { ACCOUNT_FLAGS_PAGE_SIZE } from "@/lib/flags/user-flag-state";

export const userFlagsQuerySchema = z.object({
  view: z.enum(["active", "archive"]).default("active"),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(50).default(ACCOUNT_FLAGS_PAGE_SIZE),
});
