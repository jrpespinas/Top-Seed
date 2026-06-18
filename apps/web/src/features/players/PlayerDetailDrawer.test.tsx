/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { PlayerDetailDrawer } from "./PlayerDetailDrawer.js";

vi.mock("../../hooks/usePlayerDetail.js", () => ({
  usePlayerDetail: () => ({
    checkIn: {
      id: "check-in-1",
      sessionId: "session-1",
      playerProfileId: "player-1",
      playerDisplayName: "Alex",
      arrivalOrder: 0,
      checkedInAt: "2026-06-09T18:00:00.000Z",
      queueStatus: "waiting",
      sessionSkillRating: 3,
      paymentStatus: "unpaid",
      paymentAmountDue: 150,
      paymentAmountPaid: 0,
      paymentMethod: "none",
      paymentNotes: "",
      syncStatus: "local",
    },
    session: {
      id: "session-1",
      organizationId: "org-default",
      name: "Night",
      venueName: "Hall",
      startsAt: "2026-06-09T18:00:00.000Z",
      status: "completed",
      feeAmount: 150,
      currency: "PHP",
      queueMode: "suggested",
      ratingMode: "casual",
    },
    profile: {
      id: "player-1",
      organizationId: "org-default",
      displayName: "Alex",
      defaultSkillRating: 3,
    },
    sessionMode: "ended",
    statsMap: new Map(),
  }),
}));

describe("PlayerDetailDrawer", () => {
  it("renders session and profile sections in ended mode without save", () => {
    render(
      <PlayerDetailDrawer
        sessionId="session-1"
        checkInId="check-in-1"
        isOpen
        onOpenChange={() => undefined}
      />,
    );

    expect(screen.getByText("This session")).toBeInTheDocument();
    expect(screen.getByText("Player profile")).toBeInTheDocument();
    expect(screen.queryByText("Save profile")).not.toBeInTheDocument();
    expect(screen.queryByText("Mark paid")).not.toBeInTheDocument();
  });
});
