import { useAuth } from "./auth";
import { useCatalog } from "./cloud-state";
import { updatePlans } from "./cloud.functions";
import { FREE_ACCESS } from "./access";

export type Plan = {
  id: string;
  title: string;
  price: number; // USD
  period: "month" | "quarter" | "year";
  live: boolean;
  prematch: boolean;
  api: boolean;
  dropping: boolean;
  maxProfit: number | null; // null = unlimited
  active: boolean;
};

export const DEFAULT_PLANS: Plan[] = [
  { id: "p1", title: "Basic", price: 10, period: "month", live: false, prematch: true, api: false, dropping: true, maxProfit: 15, active: true },
  { id: "p2", title: "Pro", price: 100, period: "month", live: true, prematch: true, api: true, dropping: true, maxProfit: null, active: true },
  { id: "p3", title: "Live only", price: 50, period: "month", live: true, prematch: false, api: false, dropping: true, maxProfit: null, active: false },
  { id: "p4", title: "Prematch only", price: 30, period: "month", live: false, prematch: true, api: false, dropping: true, maxProfit: null, active: false },
  { id: "p5", title: "Live + Prematch", price: 80, period: "month", live: true, prematch: true, api: false, dropping: true, maxProfit: null, active: false },
  { id: "p6", title: "Yearly Pro", price: 1000, period: "year", live: true, prematch: true, api: true, dropping: true, maxProfit: null, active: false },
];

/** Built-in free tier (not editable slot). */
export const FREE_PLAN: Plan = FREE_ACCESS;

export async function savePlans(plans: Plan[]) {
  await updatePlans({ data: plans });
  window.dispatchEvent(new Event("catalog-changed"));
}
export function usePlans() {
  const catalog = useCatalog();
  const { current } = useAuth();
  return { plans: catalog.data?.plans ?? DEFAULT_PLANS, current };
}
