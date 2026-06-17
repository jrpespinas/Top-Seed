import type { ResponseMeta } from "@top-seed/contracts";

export function buildMeta(serverVersion?: number): ResponseMeta {
  return {
    serverTime: new Date().toISOString(),
    ...(serverVersion !== undefined ? { serverVersion } : {}),
  };
}
