import { expect, test } from "vitest";
import { transferBalance } from "./accounts";
const acc = { "1xBet": { username: "a", balance: 100 }, Melbet: { username: "b", balance: 20 } };
test("moves the amount from source to destination", () => {
  const r = transferBalance(acc, "1xBet", "Melbet", 30.5)!;
  expect(r["1xBet"]!.balance).toBe(69.5);
  expect(r["Melbet"]!.balance).toBe(50.5);
});
test("rejects more than the source balance", () => expect(transferBalance(acc, "Melbet", "1xBet", 21)).toBeNull());
test("rejects same site and non-positive amounts", () => {
  expect(transferBalance(acc, "1xBet", "1xBet", 5)).toBeNull();
  expect(transferBalance(acc, "1xBet", "Melbet", 0)).toBeNull();
});
test("rejects unconnected sites", () => expect(transferBalance(acc, "1xBet", "Bet365", 5)).toBeNull());
