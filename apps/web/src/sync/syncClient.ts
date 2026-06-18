import {
  syncActionsRequestSchema,
  syncActionsResponseSchema,
  type SyncActionsRequest,
} from "@top-seed/contracts";
import type { z } from "zod";

type SyncActionsResponse = z.infer<typeof syncActionsResponseSchema>;
import type { OutboxAction } from "../db/types.js";

const apiBaseUrl = import.meta.env.VITE_API_URL ?? "";

async function parseJsonResponse(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error(
      response.ok
        ? "API returned an empty response. Is the server running?"
        : `API request failed (${response.status}) with an empty response. Is the server running?`,
    );
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`API returned invalid JSON (status ${response.status}).`);
  }
}

export async function postSyncActions(
  request: SyncActionsRequest,
): Promise<SyncActionsResponse> {
  const body = syncActionsRequestSchema.parse(request);
  const response = await fetch(`${apiBaseUrl}/api/v1/sync/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  const json: unknown = await parseJsonResponse(response);
  if (!response.ok) {
    throw new Error(
      typeof json === "object" && json !== null && "error" in json
        ? String((json as { error?: { message?: string } }).error?.message ?? response.status)
        : `Sync failed with status ${response.status}`,
    );
  }

  return syncActionsResponseSchema.parse(json);
}

export function outboxToSyncRequest(
  organizationId: string,
  deviceId: string,
  actions: OutboxAction[],
): SyncActionsRequest {
  return {
    organizationId,
    deviceId,
    actions: actions.map((action) => ({
      id: action.id,
      type: action.type,
      entityType: action.entityType,
      entityId: action.entityId,
      sessionId: action.sessionId,
      payload: action.payload,
      createdAt: action.createdAt,
    })),
  };
}
