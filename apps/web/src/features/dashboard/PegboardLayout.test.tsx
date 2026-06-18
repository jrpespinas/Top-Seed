/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { PegboardLayout } from "./PegboardLayout.js";

describe("PegboardLayout", () => {
  it("renders three pegboard zones in Available | Next | Now order", () => {
    render(
      <PegboardLayout
        available={<p>Available content</p>}
        next={<p>Next content</p>}
        now={<p>Now content</p>}
      />,
    );
    const regions = screen.getAllByRole("region");
    expect(regions.map((region) => region.getAttribute("aria-label"))).toEqual([
      "Available",
      "Next",
      "Now",
    ]);
  });
});
