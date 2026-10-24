import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const suggestBookmakers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ lines: z.array(z.string().max(300)).min(1).max(50), known: z.array(z.string().max(80)).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { checkAdmin } = await import("./cloud.server");
    await checkAdmin(context.supabase, context.userId);
    const { normalizeBookmakers } = await import("./bookmaker-ai.server");
    try { return { items: await normalizeBookmakers(data.lines, data.known), error: null as string | null }; }
    catch (e) { return { items: [], error: e instanceof Error ? e.message : "AI request failed." }; }
  });
