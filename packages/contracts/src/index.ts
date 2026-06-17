export * from "./envelopes.js";
export * from "./dtos.js";

import { createDataEnvelopeSchema } from "./envelopes.js";
import { healthDataSchema } from "./dtos.js";

export const healthResponseSchema = createDataEnvelopeSchema(healthDataSchema);
