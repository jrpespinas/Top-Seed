/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { MatchCard } from "./match-card.js";
import { SyncStatusBadge } from "./sync-status-badge.js";
import { MetricCard } from "./metric-card.js";
import { EmptyState } from "../ui/empty-state.js";

describe("MatchCard", () => {
  it("renders queued match teams", () => {
    render(
      <MatchCard
        variant="queued"
        queueLaneName="Lane A"
        match={{
          id: "m1",
          status: "queued",
          teams: [
            { name: "Team A", players: ["Alex Chen", "Jordan Lee"] },
            { name: "Team B", players: ["Sam Rivera", "Casey Park"] },
          ],
        }}
        actions={[{ label: "Send to court", onClick: () => undefined }]}
      />,
    );
    expect(screen.getByText("Lane A")).toBeInTheDocument();
    expect(screen.getByText("Alex Chen")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Send to court" })).toBeInTheDocument();
  });
});

describe("SyncStatusBadge", () => {
  it("renders pending sync label", () => {
    render(<SyncStatusBadge status="pending" />);
    expect(screen.getByText("Pending sync")).toBeInTheDocument();
  });

  it("renders local-only label", () => {
    render(<SyncStatusBadge status="local" />);
    expect(screen.getByText("Saved on this device")).toBeInTheDocument();
  });
});

describe("MetricCard", () => {
  it("renders label and value", () => {
    render(<MetricCard label="Waiting" value="8" tone="warning" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });
});

describe("EmptyState", () => {
  it("renders title and description", () => {
    render(
      <EmptyState title="No courts yet" description="Add courts when starting a session." />,
    );
    expect(screen.getByText("No courts yet")).toBeInTheDocument();
    expect(screen.getByText("Add courts when starting a session.")).toBeInTheDocument();
  });
});
