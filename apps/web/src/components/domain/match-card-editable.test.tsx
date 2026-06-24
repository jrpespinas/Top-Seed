/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MatchCard } from "../../components/domain/match-card.js";

describe("MatchCard editable slots", () => {
  afterEach(() => {
    cleanup();
  });
  it("shows Add player on empty slots when editable", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(
      <MatchCard
        variant="queuedIncomplete"
        editableSlots
        onAddPlayerToSlot={onAdd}
        match={{
          id: "qm-1",
          status: "draft",
          teams: [
            {
              name: "Team A",
              teamSide: "team_one",
              players: [],
              slots: [null, null],
            },
            {
              name: "Team B",
              teamSide: "team_two",
              players: [],
              slots: [null, null],
            },
          ],
        }}
      />,
    );
    const addButtons = screen.getAllByRole("button", { name: "Add player" });
    expect(addButtons).toHaveLength(4);
    await user.click(addButtons[0]!);
    expect(onAdd).toHaveBeenCalledWith("team_one", 1);
  });

  it("removes a player from slot overflow menu when editable", async () => {
    const user = userEvent.setup();
    const onRemove = vi.fn();
    render(
      <MatchCard
        variant="queuedIncomplete"
        editableSlots
        onRemovePlayerFromSlot={onRemove}
        match={{
          id: "qm-1",
          status: "draft",
          teams: [
            {
              name: "Team A",
              teamSide: "team_one",
              players: [],
              slots: [
                { checkInId: "check-in-1", name: "Alex", displayName: "Alex" },
                null,
              ],
            },
            {
              name: "Team B",
              teamSide: "team_two",
              players: [],
              slots: [null, null],
            },
          ],
        }}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Slot actions for Alex" }));
    await user.click(screen.getByText("Remove Alex from match"));
    expect(onRemove).toHaveBeenCalledWith("check-in-1");
  });

  it("shows fill progress for draft matches", () => {
    render(
      <MatchCard
        variant="queuedIncomplete"
        matchIndex={1}
        match={{
          id: "qm-1",
          status: "draft",
          teams: [
            {
              name: "Team A",
              teamSide: "team_one",
              players: [],
              slots: [
                { checkInId: "check-in-1", name: "Alex", displayName: "Alex" },
                null,
              ],
            },
            {
              name: "Team B",
              teamSide: "team_two",
              players: [],
              slots: [null, null],
            },
          ],
        }}
      />,
    );
    expect(screen.getByText("1/4 players")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });
});
