import { describe, expect, it } from "vitest";
import { healthResponseSchema } from "@top-seed/contracts";
import { buildApp } from "../../app.js";

describe("GET /api/v1/health", () => {
  it("returns the standard data envelope", async () => {
    const app = await buildApp();

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health",
    });

    expect(response.statusCode).toBe(200);

    const body = healthResponseSchema.parse(JSON.parse(response.body));
    expect(body.data.status).toBe("ok");
    expect(body.meta.serverTime).toBeTruthy();
  });
});
