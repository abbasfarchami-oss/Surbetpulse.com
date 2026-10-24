import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { COINS } from "./coins";

const Input = z.object({
  coin: z.string().refine((c) => COINS.some((x) => x.code === c), "unknown coin"),
  network: z.string().min(1).max(20),
  amountUsd: z.number().gt(0).max(100_000),
});

export type CreateInvoiceResult =
  | { ok: true; invoice: { id: string; address: string; amount: number; status: string } }
  | { ok: false; reason: "not-configured" | "invalid" };

/** Creates a top-up invoice via the configured gateway (none yet -> not-configured). */
export const createTopUpInvoice = createServerFn({ method: "POST" })
  .inputValidator((data) => Input.parse(data))
  .handler(async ({ data }): Promise<CreateInvoiceResult> => {
    const { getGateway } = await import("./gateway");
    try {
      const inv = await getGateway().createInvoice(data);
      return { ok: true, invoice: { id: inv.id, address: inv.address, amount: inv.amount, status: inv.status } };
    } catch (e) {
      if (e instanceof Error && e.name === "GatewayNotConfiguredError") return { ok: false, reason: "not-configured" };
      return { ok: false, reason: "invalid" };
    }
  });
