import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { Json } from "@/integrations/supabase/types";

export const planSchema = z.object({ id: z.string().regex(/^p[1-6]$/), title: z.string().min(1).max(40), price: z.number().finite().min(0), period: z.enum(["month", "quarter", "year"]), live: z.boolean(), prematch: z.boolean(), api: z.boolean(), dropping: z.boolean(), maxProfit: z.number().finite().min(0).nullable(), active: z.boolean() });
const settingSchema = z.discriminatedUnion("key", [
  z.object({ key: z.literal("book_pricing"), value: z.object({ base: z.number().finite().min(0), included: z.array(z.string()), prices: z.record(z.number().finite().min(0)) }) }),
  z.object({ key: z.literal("error_threshold"), value: z.number().finite().min(1) }),
  z.object({ key: z.literal("regional_keywords"), value: z.array(z.string().trim().min(1).max(80)).min(1).max(200) }),
  z.object({ key: z.literal("bet_mode"), value: z.enum(["odds", "slip"]) }),
  z.object({ key: z.literal("custom_books"), value: z.array(z.object({ name: z.string().max(80), domain: z.string().max(300) })).max(200) }),
]);
export type SettingInput = z.infer<typeof settingSchema>;

export const getCatalog = createServerFn({ method: "GET" }).handler(async () => {
  const { requestClient } = await import("./cloud.server");
  const client = requestClient();
  const [plans, settings] = await Promise.all([
    client.from("plans").select("config").order("position"),
    client.from("app_settings").select("key,value").in("key", ["book_pricing", "error_threshold", "regional_keywords", "bet_mode"]),
  ]);
  if (plans.error || settings.error) throw new Error("Settings unavailable");
  return { plans: plans.data.map((row) => planSchema.parse(row.config)), settings: Object.fromEntries(settings.data.map((row) => [row.key, row.value])) };
});

export const getViewer = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { viewerAccess } = await import("./cloud.server");
  return viewerAccess(context.supabase);
});
export const requireAdmin = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { checkAdmin } = await import("./cloud.server");
  await checkAdmin(context.supabase, context.userId);
  return { allowed: true };
});
export const updatePlans = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => z.array(planSchema).length(6).refine((p) => new Set(p.map((x) => x.id)).size === 6).parse(input))
  .handler(async ({ context, data }) => {
    const { checkAdmin } = await import("./cloud.server");
    await checkAdmin(context.supabase, context.userId);
    const { error } = await context.supabase.from("plans").upsert(data.map((config, index) => ({ id: config.id, position: index + 1, config })));
    if (error) throw new Error("Save failed");
    return { saved: true };
  });
export const updateSetting = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth])
  .inputValidator((input) => settingSchema.parse(input))
  .handler(async ({ context, data }) => {
    const { checkAdmin } = await import("./cloud.server");
    await checkAdmin(context.supabase, context.userId);
    const row: { key: string; value: Json } = { key: data.key, value: data.value };
    const { error } = await context.supabase.from("app_settings").upsert(row);
    if (error) throw new Error("Save failed");
    return { saved: true };
  });
export const getAdminSettings = createServerFn({ method: "POST" }).middleware([requireSupabaseAuth]).handler(async ({ context }) => {
  const { checkAdmin } = await import("./cloud.server");
  await checkAdmin(context.supabase, context.userId);
  const { data, error } = await context.supabase.from("app_settings").select("key,value").eq("key", "custom_books").single();
  if (error) throw new Error("Settings unavailable");
  return data.value;
});