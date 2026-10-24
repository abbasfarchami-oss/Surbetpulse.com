// Tiny shared output: per-reader error log + per-reader health status file. Local files only; nothing is sent anywhere.
import fs from "node:fs";
const DIR = new URL("../../reader-state/", import.meta.url);
fs.mkdirSync(DIR, { recursive: true });
export function logError(key, msg) {
  fs.appendFileSync(new URL(`${key}.err.log`, DIR), `${new Date().toISOString()} ${String(msg).slice(0, 500)}\n`);
}
export function writeStatus(key, status) {
  const s = { key, at: new Date().toISOString(), ...status };
  fs.writeFileSync(new URL(`${key}.status.json`, DIR), JSON.stringify(s, null, 1)); return s;
}
export function readStatus(key) { try { return JSON.parse(fs.readFileSync(new URL(`${key}.status.json`, DIR))); } catch { return null; } }
export function writeCapture(key, name, data) {
  const d = new URL(`captures/${key}/`, DIR); fs.mkdirSync(d, { recursive: true });
  fs.writeFileSync(new URL(name, d), typeof data === "string" ? data : JSON.stringify(data));
}
