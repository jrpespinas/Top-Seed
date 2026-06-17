import type { DomainErrorCode } from "@top-seed/domain";

export class UseCaseError extends Error {
  constructor(
    public readonly code: DomainErrorCode | string,
    message: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "UseCaseError";
  }
}

export function assertLiveSession(status: string): void {
  if (status !== "active" && status !== "open") {
    throw new UseCaseError("SESSION_NOT_ACTIVE", "This session is no longer live.");
  }
}
