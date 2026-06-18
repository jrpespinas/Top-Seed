/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PlayerRow } from "./player-row.js";

describe("PlayerRow", () => {
  it("renders player name and queue status", () => {
    render(
      <PlayerRow
        player={{ id: "p1", displayName: "Alex Chen" }}
        checkIn={{
          queueStatus: "waiting",
          sessionSkillRating: 3.4,
          checkedInAt: "2026-06-09T10:00:00.000Z",
        }}
        variant="queue"
      />,
    );
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText(/Rating 3.4/)).toBeInTheDocument();
  });

  it("renders payment badge in payment variant", () => {
    render(
      <PlayerRow
        player={{ id: "p2", displayName: "Jordan Lee" }}
        payment={{ status: "unpaid", amountDue: 150 }}
        variant="payment"
      />,
    );
    expect(screen.getByText(/Unpaid/)).toBeInTheDocument();
  });
});
