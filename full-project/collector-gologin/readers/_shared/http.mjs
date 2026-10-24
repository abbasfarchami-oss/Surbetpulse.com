// Tiny shared HTTP helper: light read-only GET with timeout. Never POSTs, never logs in.
export async function getJson(url, { timeoutMs = 15000, headers = {} } = {}) {
  const ac = new AbortController(); const t = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const r = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0", Accept: "application/json", ...headers }, redirect: "manual", signal: ac.signal });
    const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
    return { status: r.status, json, snippet: text.slice(0, 120), location: r.headers.get("location") };
  } catch (e) { return { status: 0, json: null, snippet: "", error: e.name === "AbortError" ? "timeout" : e.message }; }
  finally { clearTimeout(t); }
}
export const sortedQs = (q) => [...new URLSearchParams(q)].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join("&");
