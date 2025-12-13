import { z } from "zod";
import { ScanRequest } from "./types";

export const ScanRequestSchema: z.ZodType<ScanRequest> = z.object({
  chatId: z.string().min(1).optional(),
  messageId: z.string().min(1).optional(),
  senderIdHash: z.string().optional(),
  url: z.string().url(),
  timestamp: z.number().int().positive().optional(),
  // Fields passed by control-plane for rescans (ignored by regular scan producers)
  rescan: z.boolean().optional(),
  urlHash: z.string().min(1).optional(),
  priority: z.number().int().optional(),
});

export const OverrideBodySchema = z
  .object({
    url_hash: z.string().optional(),
    pattern: z.string().optional(),
    status: z.enum(["allow", "deny"]),
    scope: z.string().default("global"),
    scope_id: z.string().optional(),
    reason: z.string().optional(),
    expires_at: z.string().datetime().optional(),
  })
  .refine((data) => data.url_hash || data.pattern, {
    message: "Either url_hash or pattern must be provided",
  });

export type OverrideBody = z.infer<typeof OverrideBodySchema>;

export const RescanBodySchema = z.object({
  url: z.string().url(),
});

export type RescanBody = z.infer<typeof RescanBodySchema>;

export const MuteGroupParamsSchema = z.object({
  chatId: z.string().min(1),
});

export type MuteGroupParams = z.infer<typeof MuteGroupParamsSchema>;

// URLScan callback payload validation
export const URLScanCallbackSchema = z.object({
  uuid: z.string().uuid(),
  url: z.string().url(),
  visibility: z.enum(["public", "unlisted", "private"]).optional(),
  status: z.number().int().optional(),
  submissionTime: z.string().datetime().optional(),
});

export type URLScanCallback = z.infer<typeof URLScanCallbackSchema>;

// Pairing request validation (E.164 international phone number format)
export const PairingRequestSchema = z.object({
  phoneNumber: z
    .string()
    .regex(
      /^\+?[1-9]\d{1,14}$/,
      "Invalid phone number format (E.164 expected)",
    ),
});

export type PairingRequest = z.infer<typeof PairingRequestSchema>;

// URLScan queue job validation
export const URLScanJobSchema = z.object({
  chatId: z.string().min(1),
  messageId: z.string().min(1),
  url: z.string().url(),
  urlHash: z.string().min(1),
  uuid: z.string().uuid(),
});

export type URLScanJob = z.infer<typeof URLScanJobSchema>;
