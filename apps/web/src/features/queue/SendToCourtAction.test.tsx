/**
 * @vitest-environment jsdom
 */
import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { SendToCourtAction } from "./SendToCourtAction.js";

describe("SendToCourtAction", () => {
  it("sends directly when one court is open", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <SendToCourtAction
        matchIndex={1}
        openCourts={[{ id: "court-1", name: "Court 1" }]}
        onSend={onSend}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Send match #1 to Court 1" }));
    expect(onSend).toHaveBeenCalledWith("court-1");
  });

  it("shows court picker when multiple courts are open", async () => {
    const user = userEvent.setup();
    const onSend = vi.fn();
    render(
      <SendToCourtAction
        openCourts={[
          { id: "court-1", name: "Court 1" },
          { id: "court-2", name: "Court 2" },
        ]}
        onSend={onSend}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Send match to court" }));
    await user.click(screen.getByText("Court 2"));
    expect(onSend).toHaveBeenCalledWith("court-2");
  });
});
