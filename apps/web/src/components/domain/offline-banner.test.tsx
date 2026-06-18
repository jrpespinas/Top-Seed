/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OfflineBanner } from "./offline-banner.js";

describe("OfflineBanner", () => {
  it("shows offline copy", () => {
    render(
      <OfflineBanner
        connectionStatus="offline"
        syncStatus="pending"
        pendingCount={0}
        failedCount={0}
      />,
    );
    expect(screen.getByText("Offline. You can keep running this session.")).toBeInTheDocument();
  });

  it("shows pending sync copy", () => {
    render(
      <OfflineBanner
        connectionStatus="online"
        syncStatus="pending"
        pendingCount={3}
        failedCount={0}
      />,
    );
    expect(screen.getByText("3 changes pending sync.")).toBeInTheDocument();
  });

  it("shows failed sync copy", () => {
    render(
      <OfflineBanner
        connectionStatus="online"
        syncStatus="failed"
        pendingCount={0}
        failedCount={1}
        onRetry={() => undefined}
      />,
    );
    expect(screen.getByText("Sync failed for 1 change. Review and retry.")).toBeInTheDocument();
  });
});
