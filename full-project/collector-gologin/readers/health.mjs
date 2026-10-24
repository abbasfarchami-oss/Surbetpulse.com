// Per-reader health/status report. Each reader probes independently (light read-only GET). Usage: node readers/health.mjs [key,key]
import { loadReaders } from "./registry.mjs";
const only = process.argv[2]?.split(",");
const rs = await loadReaders({ only });
const res = await Promise.all(rs.map(async (r) => {
  if (r.loadError) return { key: r.key, enabled: r.enabled, built: false, error: r.loadError };
  const s = await r.mod.health().catch((e) => ({ error: e.message }));
  return { key: r.key, name: r.mod.meta.name, enabled: r.enabled, built: true, experimental: r.mod.meta.experimental, ...s };
}));
const yn = (v) => (v === true ? "yes" : v === false ? "no" : "n/a");
console.log("key".padEnd(12), "enabled", "feed", "data", " via / blocked");
for (const s of res) console.log(s.key.padEnd(12), String(s.enabled).padEnd(7), yn(s.feedResponds).padEnd(4), yn(s.verifiedData).padEnd(4),
  s.via ? `${s.via} | ${s.sample}` : (s.blocked || s.tried?.slice(-2).join(" | ") || s.error || ""));
