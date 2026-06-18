/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueuePanel } from "./QueuePanel.js";

const session = {
  id: "session-1",
  organizationId: "org-default",
  name: "Night",
  venueName: "Hall",
  startsAt: "2026-06-09T18:00:00.000Z",
  status: "active",
  feeAmount: 150,
  currency: "PHP",
  queueMode: "suggested" as const,
  ratingMode: "casual" as const,
};

describe("QueuePanel", () => {
  it("renders waiting players", () => {
    render(
      <QueuePanel
        session={session}
        sessionMode="live"
        activeTab="waiting"
        checkIns={[
          {
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
            syncStatus: "pending",
          },
        ]}
        onUpdateCheckIn={vi.fn()}
      />,
    );
    expect(screen.getByText("Alex")).toBeInTheDocument();
  });

  it("does not offer live queue actions in ended mode", () => {
    render(
      <QueuePanel
        session={session}
        sessionMode="ended"
        activeTab="waiting"
        checkIns={[
          {
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
            syncStatus: "pending",
          },
        ]}
        onUpdateCheckIn={vi.fn()}
      />,
    );
    expect(screen.queryByText("Mark resting")).not.toBeInTheDocument();
    expect(screen.getAllByText("Alex").length).toBeGreaterThan(0);
  });

  it("shows guided empty state before any check-ins", () => {
    render(
      <QueuePanel
        session={session}
        sessionMode="live"
        activeTab="waiting"
        checkIns={[]}
        onUpdateCheckIn={vi.fn()}
      />,
    );
    expect(screen.getByText("Check in your first players")).toBeInTheDocument();
  });

  it("renders filter chips and player cards on pegboard layout", () => {
    render(
      <QueuePanel
        session={session}
        sessionMode="live"
        layout="pegboard"
        checkIns={[
          {
            id: "check-in-1",
            sessionId: "session-1",
            playerProfileId: "player-1",
            playerDisplayName: "Bogs",
            arrivalOrder: 0,
            checkedInAt: "2026-06-09T18:00:00.000Z",
            queueStatus: "waiting",
            sessionSkillRating: 3,
            paymentStatus: "unpaid",
            paymentAmountDue: 150,
            paymentAmountPaid: 0,
            paymentMethod: "none",
            paymentNotes: "",
            syncStatus: "pending",
          },
        ]}
        onUpdateCheckIn={vi.fn()}
      />,
    );
    expect(screen.getByRole("tab", { name: "All (1)" })).toBeInTheDocument();
    expect(screen.getByText("Bogs")).toBeInTheDocument();
    expect(screen.getByText("Intermediate")).toBeInTheDocument();
  });
});
