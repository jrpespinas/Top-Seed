import {
  createDataEnvelopeSchema,
  createSessionRequestSchema,
  sessionDtoSchema,
} from "@top-seed/contracts";
import type { CreateSessionRequest } from "@top-seed/contracts";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

const sessionResponseSchema = createDataEnvelopeSchema(sessionDtoSchema);

export async function createSessionOnServer(input: CreateSessionRequest) {
  const body = createSessionRequestSchema.parse(input);
  const response = await fetch(`${apiBaseUrl}/api/v1/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message ?? response.status)
        : `Create session failed with status ${response.status}`,
    );
  }
  return sessionResponseSchema.parse(json).data;
}

export async function startSessionOnServer(sessionId: string) {
  const response = await fetch(`${apiBaseUrl}/api/v1/sessions/${sessionId}/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  const json: unknown = await response.json();
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message ?? response.status)
        : `Start session failed with status ${response.status}`,
    );
  }
  return sessionResponseSchema.parse(json).data;
}
