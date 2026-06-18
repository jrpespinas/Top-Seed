/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PegboardLayout } from "./PegboardLayout.js";

describe("PegboardLayout", () => {
  it("renders three pegboard zones in Player List | Upcoming Matches | Courts order", () => {
    render(
      <PegboardLayout
        playerList={<p>Player list content</p>}
        upcomingMatches={<p>Upcoming content</p>}
        courts={<p>Courts content</p>}
        playerListCount="4 total"
        upcomingCount="2 queued"
        courtsCount="3 active"
      />,
    );
    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.getAttribute("aria-label"))).toEqual([
      "Player List",
      "Upcoming Matches",
      "Courts",
    ]);
    expect(screen.getByText("Player List · 4 total")).toBeInTheDocument();
    expect(screen.getByText("Upcoming Matches · 2 queued")).toBeInTheDocument();
    expect(screen.getByText("Courts · 3 active")).toBeInTheDocument();
  });
});
