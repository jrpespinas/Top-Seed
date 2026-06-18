/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SyncReviewPanel } from "./SyncReviewPanel.js";

vi.mock("../../hooks/useSyncReview.js", () => ({
  useSyncReview: () => ({
    rows: [
      {
        action: {
          id: "failed-1",
          organizationId: "org-default",
          type: "UPDATE_PAYMENT",
          entityType: "checkIn",
          entityId: "check-in-1",
          sessionId: "session-1",
          payload: {},
          createdAt: "2026-06-09T10:00:00.000Z",
          status: "failed",
          errorMessage: "Could not sync payment.",
        },
        description: { label: "Mark Ana paid", context: "Ana" },
      },
    ],
  }),
}));

describe("SyncReviewPanel", () => {
  it("renders failed group and retry handler", async () => {
    const user = userEvent.setup();
    const onRetryAction = vi.fn(async () => undefined);

    render(
      <SyncReviewPanel
        sessionId="session-1"
        isOpen
        onOpenChange={() => undefined}
        connectionStatus="online"
        isSyncing={false}
        failedCount={1}
        blockedCount={0}
        pendingCount={0}
        onRetryAction={onRetryAction}
        onRetryAllFailed={async () => undefined}
      />,
    );

    expect(screen.getByText("Failed", { selector: "h3" })).toBeInTheDocument();
    expect(screen.getByText("Mark Ana paid")).toBeInTheDocument();
    expect(screen.queryByText("Discard")).not.toBeInTheDocument();
    expect(screen.queryByText("Export")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetryAction).toHaveBeenCalledWith("failed-1");
  });
});
