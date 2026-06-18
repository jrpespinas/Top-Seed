/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StatusBadge } from "./status-badge.js";

describe("StatusBadge", () => {
  it("renders queue waiting label", () => {
    render(<StatusBadge type="queue" status="waiting" />);
    expect(screen.getByText("Waiting")).toBeInTheDocument();
  });

  it("renders court in progress label", () => {
    render(<StatusBadge type="court" status="inProgress" />);
    expect(screen.getByText("In progress")).toBeInTheDocument();
  });

  it("renders match completed label", () => {
    render(<StatusBadge type="match" status="completed" />);
    expect(screen.getByText("Completed")).toBeInTheDocument();
  });
});
