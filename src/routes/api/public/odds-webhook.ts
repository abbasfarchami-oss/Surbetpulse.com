import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { pushOpps } from "@/lib/feed-store.server";

// Inbound only. Two sources: "collector" (Dolphin Anty browser collector) and "api" (direct data push).
const Outcome = z.object({
  label: z.string().max(80),
  bookmaker: z.string().max(60),
  odds: z.number().gt(1).lt(1000),
  prevOdds: z.number().gt(1).lt(1000).optional(),
});
const Opp = z.object({
  id: z.string().max(80),
  sport: z.string().max(40),
  league: z.string().max(80).default(""),
  event: z.string().max(160),
  market: z.string().max(80),
  live: z.boolean().optional(),
  startsAt: z.string().max(40),
  outcomes: z.array(Outcome).min(2).max(3),
  source: z.enum(["collector", "api"]).default("api"),
});
const Body = z.object({ opportunities: z.array(Opp).min(1).max(500) });

/** Constant-time string compare (no early exit on first differing char). */
function safeEqual(a: string, b: string) {
  const ea = new TextEncoder().encode(a), eb = new TextEncoder().encode(b);
  let diff = ea.length ^ eb.length;
  for (let i = 0; i < Math.max(ea.length, eb.length); i++) diff |= (ea[i] ?? 0) ^ (eb[i] ?? 0);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/odds-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { readWebhookEnvSources, resolveWebhookSecret, webhookEnvDiagnostics } = await import("@/lib/webhook-secret.server");
        const sources = readWebhookEnvSources(request);
        const secret = resolveWebhookSecret(sources);
        if (!secret) return Response.json({
          error: "unauthorized", reason: "missing_server_secret",
          ...webhookEnvDiagnostics(sources),
        }, { status: 401, headers: { "cache-control": "no-store" } });
        const header = (request.headers.get("x-webhook-secret") ?? "").trim();
        const auth = (request.headers.get("authorization") ?? "").trim();
        const bearer = /^bearer\s+/i.test(auth) ? auth.replace(/^bearer\s+/i, "").trim() : "";
        const ok = (header !== "" && safeEqual(header, secret)) || (bearer !== "" && safeEqual(bearer, secret));
        if (!ok) return Response.json({ error: "unauthorized", reason: "mismatch" }, { status: 401 });
        const parsed = Body.safeParse(await request.json().catch(() => null));
        if (!parsed.success) return Response.json({ error: parsed.error.flatten() }, { status: 400 });
        const items = parsed.data.opportunities.map((o) => {
          const m = o.outcomes.reduce((s, x) => s + 1 / x.odds, 0);
          return { ...o, type: (m < 1 ? "surebet" : "value") as "surebet" | "value", updatedAt: Date.now() };
        });
        pushOpps(items);
        return Response.json({ ok: true, received: items.length });
      },
    },
  },
});
