import { z } from "zod";

export const isoDateTimeSchema = z.string().datetime();

export const responseMetaSchema = z.object({
  serverTime: isoDateTimeSchema,
  serverVersion: z.number().int().nonnegative().optional(),
});

export const pageSchema = z.object({
  nextCursor: z.string().nullable(),
  hasMore: z.boolean(),
  limit: z.number().int().positive(),
});

export const apiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.unknown()).optional(),
});

export function createDataEnvelopeSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    data: dataSchema,
    meta: responseMetaSchema,
  });
}

export function createListEnvelopeSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    page: pageSchema,
    meta: responseMetaSchema,
  });
}

export const errorEnvelopeSchema = z.object({
  error: apiErrorSchema,
  meta: responseMetaSchema,
});

export type ResponseMeta = z.infer<typeof responseMetaSchema>;
export type ApiError = z.infer<typeof apiErrorSchema>;
export type ErrorEnvelope = z.infer<typeof errorEnvelopeSchema>;
