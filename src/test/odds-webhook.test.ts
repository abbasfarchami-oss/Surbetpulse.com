import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebhookEnvSource } from "@/lib/webhook-secret.server";

const fixtures = vi.hoisted(() => ({ sources: [] as WebhookEnvSource[], pushOpps: vi.fn() }));
vi.mock("@/lib/feed-store.server", () => ({ pushOpps: fixtures.pushOpps }));
vi.mock("@/lib/webhook-secret.server", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/webhook-secret.server")>(),
  readWebhookEnvSources: () => fixtures.sources,
}));
import { Route } from "@/routes/api/public/odds-webhook";

function post(headers: Record<string, string> = {}, body: unknown = {}) {
  const options = Route.options as unknown as {
    server: { handlers: { POST: (args: { request: Request }) => Promise<Response> } };
  };
  return options.server.handlers.POST({ request: new Request("https://example.test/api/public/odds-webhook", {
    method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body),
  }) });
}

describe("odds webhook authentication", () => {
  beforeEach(() => {
    fixtures.sources = [{ name: "runtime", env: { Webhook_Secret: " fixture " } }];
    fixtures.pushOpps.mockClear();
  });

  it("includes names-only diagnostics only for a missing server secret", async () => {
    fixtures.sources = [{ name: "runtime", env: { OTHER_SECRET: "fixture" } }, { name: "absent", env: undefined }];
    const response = await post();
    expect(response.status).toBe(401);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({
      error: "unauthorized", reason: "missing_server_secret",
      sourcesExist: { runtime: true, absent: false },
      envKeysMatching: { runtime: ["OTHER_SECRET"], absent: [] },
    });
    expect(fixtures.pushOpps).not.toHaveBeenCalled();
  });

  it("preserves mismatch responses without diagnostics", async () => {
    const response = await post({ "x-webhook-secret": "wrong" });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "unauthorized", reason: "mismatch" });
    expect(fixtures.pushOpps).not.toHaveBeenCalled();
  });

  it.each([{ "x-webhook-secret": " fixture " }, { authorization: " bEaReR fixture " }])(
    "accepts trimmed header/Bearer and 80-character market and outcome labels", async (headers) => {
      const response = await post(headers, { opportunities: [{
        id: "fixture-opportunity", sport: "Football", event: "Fixture A vs Fixture B",
        market: "M".repeat(80), startsAt: "2026-10-24T12:00:00Z",
        outcomes: [
          { label: "A".repeat(80), bookmaker: "SBOBet", odds: 2.1 },
          { label: "B".repeat(80), bookmaker: "1xBet", odds: 2.1 },
        ],
      }] });
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ ok: true, received: 1 });
      expect(fixtures.pushOpps).toHaveBeenCalledTimes(1);
    },
  );
});