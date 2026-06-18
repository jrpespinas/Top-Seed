/**
 * @vitest-environment jsdom
 */
import { describe, expect, it } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { clearDatabase, db } from "../db/database.js";
import { useSessions } from "./useSessions.js";

const session = {
  id: "session-1",
  organizationId: "org-default",
  name: "Tuesday Intense Badminton",
  venueName: "LAI 20F",
  startsAt: "2026-06-23T11:00:00.000Z",
  status: "active" as const,
  feeAmount: 200,
  currency: "PHP",
  queueMode: "suggested" as const,
  ratingMode: "casual" as const,
};

describe("useSessions", () => {
  it("loads sessions from Dexie for the list page", async () => {
    await clearDatabase();
    await db.sessions.put(session);

    const { result } = renderHook(() => useSessions("all"));

    await waitFor(() => {
      expect(result.current.sessions).toHaveLength(1);
    });
    expect(result.current.sessions[0]?.name).toBe("Tuesday Intense Badminton");
  });
});
