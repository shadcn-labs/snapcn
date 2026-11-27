/**
 * Does a regional (PPP) price paid with a foreign card get refunded, not granted?
 *
 * Run with:  pnpm vitest run app/api/webhooks/dodo/__tests__
 *
 * 2026-11-20: a buyer on a French IP set billing to India for the ₹ Lifetime,
 * cycling a US, a French and a US Discover card. The billing country is a
 * dropdown; the card's issuing country is not.
 */

import { createHmac, randomBytes } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const h = vi.hoisted(() => ({
  grants: [] as Array<{ plan: string; status: string }>,
  refunds: [] as string[],
  cancels: [] as string[],
  mails: [] as string[],
  row: null as null | Record<string, unknown>,
}));

vi.mock("@/lib/analytics-server", () => ({ captureServer: async () => {} }));
vi.mock("@/lib/server/db", () => ({ isDbConfigured: true }));
vi.mock("@/lib/server/entitlements", () => ({
  activatePlan: async (a: { plan: string; status: string }) => {
    h.grants.push({ plan: a.plan, status: a.status });
  },
  billingFor: async () => h.row,
  userIdForEmail: async () => "user_1",
}));
vi.mock("@/lib/server/email", () => ({
  sendEmail: async () => true,
  proReadyEmail: () => ({}),
  paymentFailedEmail: () => ({}),
  regionalRefundEmail: (_to: string, country: string) => {
    h.mails.push(country);
    return {};
  },
}));
vi.mock("@/lib/server/dodo", async (orig) => ({
  ...(await orig<typeof import("@/lib/server/dodo")>()),
  refundPayment: async (id: string) => {
    h.refunds.push(id);
  },
  cancelSubscription: async (id: string) => {
    h.cancels.push(id);
  },
}));

import { POST } from "@/app/api/webhooks/dodo/route";

const SECRET = `whsec_${randomBytes(32).toString("base64")}`;

function signed(body: unknown): Request {
  const raw = JSON.stringify(body);
  const ts = Math.floor(Date.now() / 1000);
  const key = Buffer.from(SECRET.replace(/^whsec_/, ""), "base64");
  const sig = createHmac("sha256", key)
    .update(`msg_1.${ts}.${raw}`)
    .digest("base64");
  return new Request("https://snapcn.dev/api/webhooks/dodo", {
    method: "POST",
    headers: {
      "webhook-id": "msg_1",
      "webhook-timestamp": String(ts),
      "webhook-signature": `v1,${sig}`,
    },
    body: raw,
  });
}

const paid = (data: Record<string, unknown> = {}) => ({
  type: "payment.succeeded",
  data: {
    payment_id: "pay_1",
    checkout_session_id: "cks_1",
    metadata: { product: "lifetime", user_id: "user_1" },
    customer: { email: "buyer@example.com" },
    billing: { country: "IN" },
    card_issuing_country: "US",
    ...data,
  },
});

beforeEach(() => {
  h.grants.length = 0;
  h.refunds.length = 0;
  h.cancels.length = 0;
  h.mails.length = 0;
  h.row = null;
  process.env.DODO_WEBHOOK_SECRET = SECRET;
});

it("refunds an Indian price paid with a US card, and grants nothing", async () => {
  const res = await POST(signed(paid()));
  expect(res.status).toBe(200);
  expect(h.refunds).toEqual(["pay_1"]);
  expect(h.grants).toEqual([]);
  expect(h.mails).toEqual(["IN"]);
});

it("grants a local card, a cardless local method, and a product with no regional price", async () => {
  await POST(signed(paid({ card_issuing_country: "IN" })));
  await POST(signed(paid({ card_issuing_country: undefined })));
  await POST(
    signed(paid({ metadata: { product: "commercial", user_id: "user_1" } })),
  );
  expect(h.refunds).toEqual([]);
  expect(h.grants.map((g) => g.status)).toEqual(["active", "active", "active"]);
});

it("leaves a renewal alone", async () => {
  await POST(signed(paid({ checkout_session_id: undefined })));
  expect(h.refunds).toEqual([]);
});

it("cancels an annual, marks it refunded, and a late subscription.active cannot re-grant it", async () => {
  await POST(
    signed(
      paid({
        subscription_id: "sub_1",
        metadata: { product: "everything_annual", user_id: "user_1" },
      }),
    ),
  );
  expect(h.cancels).toEqual(["sub_1"]);
  expect(h.refunds).toEqual(["pay_1"]);
  expect(h.grants).toEqual([{ plan: h.grants[0]?.plan, status: "refunded" }]);

  h.grants.length = 0;
  h.row = {
    plan: "everything",
    status: "refunded",
    subscriptionId: "sub_1",
    currentPeriodEnd: null,
  };
  await POST(
    signed({
      type: "subscription.active",
      data: {
        subscription_id: "sub_1",
        metadata: { product: "everything_annual", user_id: "user_1" },
      },
    }),
  );
  await POST(
    signed({
      type: "subscription.cancelled",
      data: {
        subscription_id: "sub_1",
        metadata: { product: "everything_annual", user_id: "user_1" },
      },
    }),
  );
  expect(h.grants).toEqual([]);
});
