"use client";

import { useState } from "react";
import { AFFILIATE, commissionCents, netCents, usd } from "@/lib/affiliate";
import { cn } from "@/lib/utils";

export interface EarningsPlan {
  name: string;
  /** USD list price, cents — from `CHECKOUT_PRODUCTS`, passed in by the page. */
  cents: number;
  /** How the buyer pays, as it reads under the commission. */
  terms: string;
}

/**
 * The plans as a radio group, and a pace slider under them: what one referral
 * is worth, then what a month of them is. The per-sale number is the real
 * answer; the monthly one is there because that is the question people ask.
 *
 * A native range input (rung 4) — keyboard, touch and screen readers for free,
 * tinted with `accent-color`.
 */
export function Earnings({ plans }: { plans: EarningsPlan[] }) {
  const [picked, setPicked] = useState(1);
  const [sales, setSales] = useState(5);
  const plan = plans[picked];
  const perSale = commissionCents(plan.cents);

  return (
    <div>
      <fieldset className="grid min-w-0 gap-4 md:grid-cols-3">
        <legend className="sr-only">Plan the buyer picks</legend>
        {plans.map((p, i) => {
          const on = i === picked;
          return (
            // A real radio under a label: arrow keys, focus and the checked
            // state are the browser's, the card is only its paint.
            <label
              key={p.name}
              className={cn(
                "cursor-pointer rounded-3xl border bg-card px-6 pt-5 pb-6 shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-150 ease-out has-[:focus-visible]:ring-4 has-[:focus-visible]:ring-primary/20",
                on
                  ? "border-primary/40 ring-4 ring-primary/10"
                  : "border-border hover:border-foreground/20",
              )}
            >
              <input
                type="radio"
                name="affiliate-plan"
                className="sr-only"
                checked={on}
                onChange={() => setPicked(i)}
              />
              <span className="flex items-center justify-between">
                <span className="text-lg text-muted-foreground">{p.name}</span>
                <span
                  aria-hidden
                  className={cn(
                    "grid size-4 place-items-center rounded-full border transition-colors duration-150",
                    on ? "border-primary bg-primary" : "border-border",
                  )}
                >
                  {on ? (
                    <span className="size-1.5 rounded-full bg-primary-foreground" />
                  ) : null}
                </span>
              </span>
              <span className="mt-6 block font-semibold text-5xl text-foreground tabular-nums tracking-tight">
                {usd(commissionCents(p.cents))}
              </span>
              <span className="mt-1 block text-muted-foreground text-sm">
                per sale · {AFFILIATE.percent}% of ~{usd(netCents(p.cents))} net
              </span>
              <span className="mt-5 block border-border/60 border-t pt-4 text-muted-foreground text-sm">
                {p.terms}
              </span>
            </label>
          );
        })}
      </fieldset>

      <div className="mt-4 grid gap-10 rounded-[5px] bg-muted p-6 sm:p-10 md:grid-cols-2 md:items-end">
        <div>
          <label htmlFor="sales-per-month" className="text-current/70 text-sm">
            {plan.name} sales you send in a month
          </label>
          <p className="mt-2 font-normal text-[clamp(2.5rem,5vw,3.5rem)] text-foreground tabular-nums leading-none tracking-[-0.04em]">
            {sales}
          </p>
          <input
            id="sales-per-month"
            type="range"
            min={1}
            max={50}
            value={sales}
            onChange={(e) => setSales(Number(e.target.value))}
            className="mt-6 w-full cursor-pointer accent-primary"
          />
          <div className="mt-1 flex justify-between text-current/50 text-xs tabular-nums">
            <span>1</span>
            <span>50</span>
          </div>
        </div>
        <div className="md:text-right" aria-live="polite">
          <p className="text-current/70 text-sm">You earn</p>
          <p className="mt-2 font-normal text-[clamp(2.5rem,5vw,3.5rem)] text-foreground tabular-nums leading-none tracking-[-0.04em]">
            {usd(perSale * sales)}
            <span className="text-current/50 text-lg tracking-normal">
              {" "}
              / month
            </span>
          </p>
          <p className="mt-3 text-current/70 text-sm tabular-nums">
            {usd(perSale * sales * 12)} over a year
          </p>
        </div>
      </div>
    </div>
  );
}
