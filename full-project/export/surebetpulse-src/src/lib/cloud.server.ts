import { createClient } from "@supabase/supabase-js";
import { createServerOnlyFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import type { Database } from "@/integrations/supabase/types";
import { assertAdminRole, FREE_ACCESS, subscriptionAccess, type Entitlement } from "./access";

export const requestClient = createServerOnlyFn(() => {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) throw new Error("Cloud unavailable");
  const authorization = getRequest().headers.get("authorization");
  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      headers: authorization ? { Authorization: authorization } : {},
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
});

export async function checkAdmin(client: ReturnType<typeof requestClient>, userId: string) {
  const { data, error } = await client.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) throw new Error("Access check failed");
  assertAdminRole(data === true);
}

export async function viewerAccess(client: ReturnType<typeof requestClient>) {
  const header = getRequest().headers.get("authorization");
  if (!header) return { user: null, isAdmin: false, current: FREE_ACCESS };
  const { data: { user }, error: authError } = await client.auth.getUser(header.replace(/^Bearer\s+/i, ""));
  if (authError || !user) throw new Error("Unauthorized");
  const { data: isAdmin, error: roleError } = await client.rpc("has_role", { _user_id: user.id, _role: "admin" });
  if (roleError) throw new Error("Access check failed");
  if (isAdmin) return { user: { id: user.id, email: user.email }, isAdmin: true, current: subscriptionAccess(true, null) };
  const { data: sub, error } = await client.from("subscriptions").select("plan_id,status,expires_at").eq("user_id", user.id).maybeSingle();
  if (error) throw new Error("Subscription unavailable");
  const { data: plan } = sub?.plan_id ? await client.from("plans").select("config").eq("id", sub.plan_id).maybeSingle() : { data: null };
  return { user: { id: user.id, email: user.email }, isAdmin: false, current: subscriptionAccess(false, plan?.config as Entitlement | null, sub?.status, sub?.expires_at) };
}