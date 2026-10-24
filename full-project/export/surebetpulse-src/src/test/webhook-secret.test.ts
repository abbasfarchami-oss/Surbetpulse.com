import { describe, expect, it } from "vitest";
import { readWebhookEnvSources, resolveWebhookSecret, webhookEnvDiagnostics } from "@/lib/webhook-secret.server";

describe("webhook secret lookup", () => {
  it("uses WEBHOOK_SECRET when it is set", () => {
    expect(resolveWebhookSecret({ WEBHOOK_SECRET: "s3cret" })).toBe("s3cret");
  });

  it("trims whitespace around the primary value", () => {
    expect(resolveWebhookSecret({ WEBHOOK_SECRET: "  s3cret \n" })).toBe("s3cret");
  });

  it("falls back to any case variant of webhook_secret", () => {
    for (const key of ["webhook_secret", "Webhook_Secret", "Webhook_secret", "webhook_SECRET", "WEBHOOK_SECRET"]) {
      expect(resolveWebhookSecret({ [key]: "abc123" }), key).toBe("abc123");
    }
  });

  it("trims a fallback value too", () => {
    expect(resolveWebhookSecret({ Webhook_Secret: "  abc123  " })).toBe("abc123");
  });

  it("keeps scanning when the primary value is blank", () => {
    expect(resolveWebhookSecret({ WEBHOOK_SECRET: "   ", Webhook_secret: "abc123" })).toBe("abc123");
  });

  it("ignores unrelated keys and returns empty when nothing matches", () => {
    expect(resolveWebhookSecret({ ODDS_FEED_KEY: "x", SECRET: "y", MY_WEBHOOK_SECRET: "z" })).toBe("");
    expect(resolveWebhookSecret({})).toBe("");
  });

  it("skips a blank fallback and keeps scanning for a usable one", () => {
    expect(resolveWebhookSecret({ webhook_secret: "  ", Webhook_Secret: "abc123" })).toBe("abc123");
  });

  it("scans every supported source case-insensitively", () => {
    for (const name of ["process.env", "globalThis.process.env", "import.meta.env", "request.runtime.cloudflare.env", "globalThis.__env__"]) {
      expect(resolveWebhookSecret([
        { name: "absent", env: undefined },
        { name: "blank", env: { WEBHOOK_SECRET: " " } },
        { name, env: { Webhook_Secret: " fixture " } },
      ]) === "fixture").toBe(true);
    }
  });

  it("uses ordered source precedence and ignores non-string bindings", () => {
    expect(resolveWebhookSecret([
      { name: "invalid", env: { WEBHOOK_SECRET: { binding: true }, webhook_secret: 42 } },
      { name: "first", env: { webhook_secret: "first" } },
      { name: "second", env: { WEBHOOK_SECRET: "second" } },
    ]) === "first").toBe(true);
  });

  it("reads the request-scoped Nitro Worker binding", () => {
    const request = Object.assign(new Request("https://example.test"), {
      runtime: { cloudflare: { env: { Webhook_secret: " fixture " } } },
    });
    const source = readWebhookEnvSources(request).find((s) => s.name === "request.runtime.cloudflare.env");
    expect(resolveWebhookSecret(source ? [source] : []) === "fixture").toBe(true);
  });

  it("never reads import.meta.env as a browser secret source", () => {
    expect(readWebhookEnvSources().find((s) => s.name === "import.meta.env")?.env).toBeUndefined();
  });

  it("reports only matching key names and source presence without reading values", () => {
    const env = Object.defineProperty({ PUBLIC_SETTING: "ignored" }, "Webhook_Secret", {
      enumerable: true,
      get() { throw new Error("Diagnostic must not read a value"); },
    });
    expect(webhookEnvDiagnostics([
      { name: "available", env }, { name: "absent", env: undefined },
      { name: "empty", env: {} },
    ])).toEqual({
      sourcesExist: { available: true, absent: false, empty: true },
      envKeysMatching: { available: ["Webhook_Secret"], absent: [], empty: [] },
    });
  });
});
