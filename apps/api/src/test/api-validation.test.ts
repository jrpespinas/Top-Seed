import { describe, expect, it } from "vitest";
import { buildApp } from "../app.js";

describe("API validation without database", () => {
  it("rejects invalid sync request body", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sync/actions",
      payload: { organizationId: "org", deviceId: "dev" },
    });
    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body);
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects invalid session create body", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "POST",
      url: "/api/v1/sessions",
      payload: { name: "missing fields" },
    });
    expect(response.statusCode).toBe(400);
  });

  it("returns sync status stub", async () => {
    const app = await buildApp();
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/sync/status",
    });
    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.pendingCount).toBe(0);
  });
});
