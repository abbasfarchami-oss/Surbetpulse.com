import type { Opportunity } from "./arb";
import { profitPct, valueEdge } from "./arb";

export type Entitlement = { id: string; title: string; price: number; period: "month" | "quarter" | "year"; live: boolean; prematch: boolean; api: boolean; dropping: boolean; maxProfit: number | null; active: boolean };
export const FREE_ACCESS: Entitlement = { id: "free", title: "Free", price: 0, period: "month", live: false, prematch: true, api: false, dropping: false, maxProfit: 1, active: true };
export const ADMIN_ACCESS: Entitlement = { ...FREE_ACCESS, id: "admin", title: "Admin", live: true, prematch: true, api: true, dropping: true, maxProfit: null };

export function subscriptionAccess(isAdmin: boolean, plan: Entitlement | null, status?: string, expiresAt?: string | null, now = Date.now()): Entitlement {
  if (isAdmin) return ADMIN_ACCESS;
  if (!plan?.active || status !== "active" || (expiresAt != null && (!Number.isFinite(Date.parse(expiresAt)) || Date.parse(expiresAt) <= now))) return FREE_ACCESS;
  return plan;
}
export function allowsOpportunity(plan: Entitlement, row: Opportunity) {
  const edge = row.type === "surebet" ? profitPct(row.outcomes) : valueEdge(row);
  return (row.live ? plan.live : plan.prematch) && (plan.maxProfit == null || edge <= plan.maxProfit);
}
export function assertAdminRole(isAdmin: boolean) {
  if (!isAdmin) throw new Error("Forbidden");
}