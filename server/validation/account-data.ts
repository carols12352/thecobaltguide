import { z } from "zod";

export const accountDeletionSchema = z.object({
  confirmation: z.literal("DELETE"),
});
