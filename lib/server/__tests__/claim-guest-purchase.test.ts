/**
 * Which guest purchases a signed-in buyer may pull onto their account.
 *
 * Run with:  pnpm vitest run lib/server/__tests__/claim-guest-purchase.test.ts
 */
import { expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("@/lib/server/db", () => ({
  isDbConfigured: false,
  getDb: () => null,
}));

const { isClaimable } = await import("@/lib/server/entitlements");

const now = Date.parse("2026-11-07T14:00:00Z");
const guest = {
  payment_id: "pay_1",
  status: "succeeded",
  created_at: "2026-11-07T13:09:43Z",
  customer: { customer_id: "cus_1", email: "lennart@lou4oyu.com" },
  metadata: { product: "everything_annual" },
};

it("claims a recent guest purchase of ours", () => {
  expect(isClaimable(guest, now)).toBe(true);
});

it("refuses a purchase made while signed in", () => {
  expect(
    isClaimable(
      { ...guest, metadata: { ...guest.metadata, user_id: "u" } },
      now,
    ),
  ).toBe(false);
});

it("refuses an unpaid, foreign or stale purchase", () => {
  expect(isClaimable({ ...guest, status: "failed" }, now)).toBe(false);
  expect(
    isClaimable({ ...guest, metadata: { product: "other_brand" } }, now),
  ).toBe(false);
  expect(isClaimable(guest, now + 25 * 60 * 60 * 1000)).toBe(false);
});
