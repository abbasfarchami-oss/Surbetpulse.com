import { createFileRoute } from "@tanstack/react-router";

/**
 * Payment gateway webhook (stub). External gateways call this URL, so it lives
 * under /api/public/ (bypasses site auth) and authenticates the caller itself:
 * an HMAC-SHA256 hex signature of the raw body in the `x-payment-signature`
 * header, verified against PAYMENT_WEBHOOK_SECRET with a constant-time compare.
 *
 * Until the secret is set, every call returns 501. Once a gateway is connected
 * (see src/lib/payments/gateway.ts for the NOWPayments / Cryptomus / Plisio
 * plug-in points), map its payload onto InvoiceStatus here and update the
 * invoice record.
 */

async function hmacSha256Hex(secret: string, body: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Constant-time string compare (avoids leaking the signature prefix via timing). */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export const Route = createFileRoute("/api/public/payments-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env["PAYMENT_WEBHOOK_SECRET"];
        if (!secret) return Response.json({ error: "payment gateway not configured" }, { status: 501 });

        const body = await request.text();
        const signature = request.headers.get("x-payment-signature") ?? "";
        const expected = await hmacSha256Hex(secret, body);
        if (!timingSafeEqual(signature, expected)) {
          return Response.json({ error: "invalid signature" }, { status: 401 });
        }

        // Signature is valid, but no gateway is wired up yet. When one is:
        // parse the provider payload, map it to InvoiceStatus, and record it.
        return Response.json({ error: "payment gateway not configured" }, { status: 501 });
      },
    },
  },
});
