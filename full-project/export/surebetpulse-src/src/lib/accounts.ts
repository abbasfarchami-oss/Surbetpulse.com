import { useEffect, useState } from "react";

export type Account = { username: string; balance: number };
const KEY = "accounts_v1";
const EVT = "accounts-changed";

export function useAccounts() {
  const [accounts, setAccounts] = useState<Record<string, Account>>({});
  useEffect(() => {
    const sync = () => {
      try { setAccounts(JSON.parse(localStorage.getItem(KEY) || "{}")); } catch { setAccounts({}); }
    };
    sync();
    window.addEventListener(EVT, sync);
    return () => window.removeEventListener(EVT, sync);
  }, []);
  const save = (next: Record<string, Account>) => {
    localStorage.setItem(KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(EVT));
  };
  return { accounts, save };
}

/** Moves `amount` USD from one connected account to another; returns null when invalid. */
export function transferBalance(accounts: Record<string, Account>, from: string, to: string, amount: number): Record<string, Account> | null {
  const a = accounts[from], b = accounts[to];
  if (!a || !b || from === to || !(amount > 0) || amount > a.balance) return null;
  const round = (n: number) => Math.round(n * 100) / 100;
  return { ...accounts, [from]: { ...a, balance: round(a.balance - amount) }, [to]: { ...b, balance: round(b.balance + amount) } };
}
