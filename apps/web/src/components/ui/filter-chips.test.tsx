/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { FilterChips } from "./filter-chips.js";

describe("FilterChips", () => {
  it("renders options and calls onChange", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <FilterChips
        value="all"
        onChange={onChange}
        options={[
          { value: "all", label: "All", count: 4 },
          { value: "available", label: "Available", count: 2 },
        ]}
      />,
    );
    expect(screen.getByRole("tab", { name: "All (4)" })).toHaveAttribute("aria-selected", "true");
    await user.click(screen.getByRole("tab", { name: "Available (2)" }));
    expect(onChange).toHaveBeenCalledWith("available");
  });
});
