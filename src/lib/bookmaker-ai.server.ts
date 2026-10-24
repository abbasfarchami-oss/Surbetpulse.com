export type BookSuggestion = { input: string; canonical: string; domain: string; duplicateOf: string | null; note: string };

const schema = {
  type: "object", additionalProperties: false, required: ["items"],
  properties: { items: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["input", "canonical", "domain", "duplicateOf", "note"],
    properties: {
      input: { type: "string" }, canonical: { type: "string" }, domain: { type: "string" },
      duplicateOf: { type: ["string", "null"] }, note: { type: "string" },
    } } } },
};

/** Streams a Responses call and returns parsed suggestions. Throws Error with a safe message. */
export async function normalizeBookmakers(lines: string[], known: string[]): Promise<BookSuggestion[]> {
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("AI is not configured.");
  const res = await fetch("https://ai.gateway.lovable.dev/v1/responses", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "fetch" },
    body: JSON.stringify({
      model: "openai/gpt-6-astra", stream: true, store: false,
      reasoning: { effort: "low", summary: "auto" }, include: ["reasoning.encrypted_content"],
      text: { format: { type: "json_schema", name: "bookmakers", strict: true, schema } },
      input: [
        { role: "system", content: "You normalize sportsbook/bookmaker names scraped from odds feeds. For each input line (name and optional URL) return the official brand spelling (canonical), its main domain without scheme, and duplicateOf: the name from the KNOWN list or from an earlier input that is the same brand or a mirror domain, else null. note: short reason in English. Keep input order, one item per line." },
        { role: "user", content: `KNOWN:\n${known.join("\n")}\n\nINPUT:\n${lines.join("\n")}` },
      ],
    }),
  });
  if (!res.ok || !res.body) {
    const msg = res.status === 402 ? "AI credits are used up." : res.status === 429 ? "Too many requests, try again shortly." : `AI request failed (${res.status}).`;
    throw new Error(msg);
  }
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", text = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line.startsWith("data:")) continue;
      const d = line.slice(5).trim(); if (d === "[DONE]") continue;
      try {
        const e = JSON.parse(d);
        if (e.type === "response.output_text.delta") text += e.delta;
        if (e.type === "error" || e.type === "response.failed") throw new Error("AI request failed.");
        if (e.type === "response.refusal.delta") throw new Error("The AI declined this request.");
      } catch (err) { if (err instanceof Error && err.message.startsWith("AI") || (err as Error).message?.startsWith("The AI")) throw err; }
    }
  }
  if (!text) throw new Error("The AI returned no answer.");
  return (JSON.parse(text) as { items: BookSuggestion[] }).items;
}
