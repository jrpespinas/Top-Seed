import { z } from "zod";
import { queueModeSchema, ratingModeSchema } from "@top-seed/contracts";

export const sessionFormSchema = z.object({
  name: z.string().min(1, "Session name is required."),
  venueName: z.string().min(1, "Venue is required."),
  startsAtLocal: z.string().min(1, "Start time is required."),
  feeAmount: z.coerce.number().int().nonnegative(),
  currency: z.string().min(1),
  courtCount: z.coerce.number().int().min(2).max(8),
  queueMode: queueModeSchema,
  ratingMode: ratingModeSchema,
});

export type SessionFormValues = z.infer<typeof sessionFormSchema>;

export const defaultSessionFormValues: SessionFormValues = {
  name: "",
  venueName: "",
  startsAtLocal: "",
  feeAmount: 150,
  currency: "PHP",
  courtCount: 2,
  queueMode: "suggested",
  ratingMode: "casual",
};

export function toIsoDateTime(localValue: string): string {
  return new Date(localValue).toISOString();
}

export function defaultStartsAtLocal(): string {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60_000);
  return local.toISOString().slice(0, 16);
}
