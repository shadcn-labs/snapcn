import type { DefaultSession } from "next-auth";
import type { PlanName, PlanTier } from "@/lib/plans";

declare module "next-auth" {
  /**
   * Expose the database user id and the billing plan on the session (both set
   * in `auth.ts` callbacks).
   */
  interface Session {
    user: {
      id: string;
      plan: PlanName;
      /** The plan as bought — Lifetime and Commercial are `plan: "pro"`. */
      tier?: PlanTier;
    } & DefaultSession["user"];
  }
}
