import fs from "node:fs";
export const REGISTRY = JSON.parse(fs.readFileSync(new URL("./registry.json", import.meta.url)));
export async function loadReaders({ onlyEnabled = false, only = null } = {}) {
  const out = [];
  for (const r of REGISTRY.readers) {
    if (onlyEnabled && !r.enabled) continue; if (only && !only.includes(r.key)) continue;
    try { out.push({ ...r, mod: await import(new URL(r.file, import.meta.url)) }); }
    catch (e) { out.push({ ...r, loadError: e.message }); } // one broken reader never stops the others
  }
  return out;
}
