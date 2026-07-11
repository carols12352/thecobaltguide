import { z } from "zod";
import { CATEGORY_VALUES } from "@/config/categories";
import { MULTIPLIER_OPTIONS } from "@/config/constants";

export const viewportQuerySchema = z.object({
  north: z.coerce.number().min(-90).max(90),
  south: z.coerce.number().min(-90).max(90),
  east: z.coerce.number().min(-180).max(180),
  west: z.coerce.number().min(-180).max(180),
  zoom: z.coerce.number().min(1).max(22).optional(),
  multiplier: z.coerce
    .number()
    .refine((v) => MULTIPLIER_OPTIONS.includes(v as 1 | 2 | 3 | 5))
    .optional(),
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]).optional(),
  card: z.string().optional(),
});

export const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  latitude: z.coerce.number().min(-90).max(90).optional(),
  longitude: z.coerce.number().min(-180).max(180).optional(),
  limit: z.coerce.number().min(1).max(50).default(20),
});

export const geocodeQuerySchema = z.object({
  name: z.string().max(200).optional(),
  addressLine1: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
});

export const createPlaceSchema = z.object({
  name: z.string().min(1).max(200),
  addressLine1: z.string().min(1).max(300),
  city: z.string().min(1).max(100),
  province: z.string().min(1).max(100),
  postalCode: z.string().min(1).max(20),
  countryCode: z.string().length(2).default("CA"),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]),
  acceptsAmex: z.boolean().optional(),
  externalPlaceId: z.string().max(500).optional(),
  brandId: z.string().uuid().optional(),
});

export const createReportSchema = z.object({
  multiplier: z
    .number()
    .refine((v) => MULTIPLIER_OPTIONS.includes(v as 1 | 2 | 3 | 5)),
  transactionDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((d) => new Date(d) <= new Date(), "Transaction date cannot be in the future"),
  paymentContext: z.enum([
    "in_store",
    "online",
    "gas_pump",
    "delivery",
    "other",
  ]),
  notes: z.string().max(500).optional(),
  cardProductId: z.string().uuid().optional(),
});

export const createFlagSchema = z.object({
  reason: z.enum([
    "duplicate",
    "wrong_address",
    "permanently_closed",
    "does_not_accept_amex",
    "incorrect_category",
    "other",
  ]),
  details: z.string().max(1000).optional(),
});

export const adminReportPatchSchema = z.object({
  status: z.enum(["active", "removed", "flagged"]),
  moderationReason: z.string().max(500).optional(),
});

export const adminFlagPatchSchema = z.object({
  status: z.enum(["open", "resolved", "dismissed"]),
});

export const adminPlacePatchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  addressLine1: z.string().min(1).max(300).optional(),
  city: z.string().min(1).max(100).optional(),
  province: z.string().min(1).max(100).optional(),
  postalCode: z.string().min(1).max(20).optional(),
  category: z.enum(CATEGORY_VALUES as [string, ...string[]]).optional(),
  acceptsAmex: z.boolean().optional(),
  status: z.enum(["active", "permanently_closed", "merged"]).optional(),
});

export const adminPlaceMergeSchema = z.object({
  sourcePlaceId: z.string().uuid(),
  targetPlaceId: z.string().uuid(),
  reason: z.string().max(500).optional(),
});

export const adminUserPatchSchema = z.object({
  role: z.enum(["user", "moderator", "admin"]).optional(),
  status: z.enum(["active", "suspended"]).optional(),
});

export type ViewportQuery = z.infer<typeof viewportQuerySchema>;
export type CreatePlaceInput = z.infer<typeof createPlaceSchema>;
export type CreateReportInput = z.infer<typeof createReportSchema>;
export type CreateFlagInput = z.infer<typeof createFlagSchema>;
