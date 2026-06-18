/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { SuggestionStrip } from "./SuggestionStrip.js";

describe("SuggestionStrip", () => {
  it("hides suggestion UI in manual queue mode", () => {
    render(
      <SuggestionStrip
        sessionMode="live"
        queueMode="manual"
        suggestion={null}
        selectedLaneName="Next"
        openCourtCount={1}
        onAccept={vi.fn()}
      />,
    );
    expect(screen.getByText(/Manual queue mode/i)).toBeInTheDocument();
  });

  it("renders accept action when suggestion is ready", () => {
    render(
      <SuggestionStrip
        sessionMode="live"
        queueMode="suggested"
        suggestion={{
          explanation: "Balanced teams",
          teamOneNames: ["A", "B"],
          teamTwoNames: ["C", "D"],
        }}
        selectedLaneName="Next"
        openCourtCount={2}
        onAccept={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "Add to Next" })).toBeInTheDocument();
  });
});
