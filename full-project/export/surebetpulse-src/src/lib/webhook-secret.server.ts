// Invoke only inside the server POST handler. Never log or serialize a value.
type Env = Record<string, unknown>;
export type WebhookEnvSource = { name: string; env: Env | undefined };

function asEnv(value: unknown): Env | undefined {
  return value !== null && typeof value === "object" ? value as Env : undefined;
}

/** Nitro augments each Worker request with runtime.cloudflare.env. */
export function readWebhookEnvSources(request?: Request): WebhookEnvSource[] {
  const globals = globalThis as typeof globalThis & { process?: { env?: Env }; __env__?: unknown };
  const runtime = asEnv(asEnv(request)?.["runtime"]);
  const cloudflare = asEnv(runtime?.["cloudflare"]);
  return [
    { name: "process.env", env: typeof process === "undefined" ? undefined : asEnv(process.env) },
    { name: "globalThis.process.env", env: asEnv(globals.process?.env) },
    // Private env must never be read from a browser import.meta.env.
    { name: "import.meta.env", env: import.meta.env.SSR ? asEnv(import.meta.env) : undefined },
    { name: "request.runtime.cloudflare.env", env: asEnv(cloudflare?.["env"]) },
    // Nitro's Cloudflare module preset also exposes this runtime binding.
    { name: "globalThis.__env__", env: asEnv(globals.__env__) },
  ];
}

/** Prefer the canonical key in each source, then exact case variants. */
export function resolveWebhookSecret(
  input: Env | WebhookEnvSource[] = readWebhookEnvSources(),
): string {
  const sources = Array.isArray(input) ? input : [{ name: "provided", env: input }];
  for (const { env } of sources) {
    if (!env) continue;
    const direct = env["WEBHOOK_SECRET"];
    if (typeof direct === "string" && direct.trim()) return direct.trim();
    for (const key of Object.keys(env)) {
      if (key.toLowerCase() !== "webhook_secret") continue;
      const value = env[key];
      if (typeof value === "string" && value.trim()) return value.trim();
    }
  }
  return "";
}

/** Temporary missing-secret diagnostics: enumerate names, never read values. */
export function webhookEnvDiagnostics(sources: WebhookEnvSource[]) {
  return {
    sourcesExist: Object.fromEntries(sources.map(({ name, env }) => [name, env !== undefined])),
    envKeysMatching: Object.fromEntries(sources.map(({ name, env }) => [
      name, env ? Object.keys(env).filter((key) => /webhook|secret/i.test(key)).sort() : [],
    ])),
  };
}
