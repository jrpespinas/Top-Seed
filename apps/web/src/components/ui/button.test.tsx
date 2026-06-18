/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Button } from "./button.js";

describe("Button", () => {
  it("renders primary variant", () => {
    render(<Button>Mark paid</Button>);
    expect(screen.getByRole("button", { name: "Mark paid" })).toBeInTheDocument();
  });

  it("blocks click when loading", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(
      <Button isLoading onClick={onClick}>
        Save
      </Button>,
    );
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toBeDisabled();
    await user.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("calls onClick when enabled", async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Finish match</Button>);
    await user.click(screen.getByRole("button", { name: "Finish match" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
