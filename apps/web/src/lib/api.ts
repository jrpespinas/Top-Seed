import { healthResponseSchema } from "@top-seed/contracts";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

export async function fetchHealth() {
  const response = await fetch(`${apiBaseUrl}/api/v1/health`);
  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }
  const json: unknown = await response.json();
  return healthResponseSchema.parse(json);
}
