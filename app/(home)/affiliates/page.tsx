import { ArrowRight, Copy, MousePointerClick, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { Cta } from "@/app/(home)/components/sections/cta";
import { FaqChat } from "@/app/(home)/components/sections/faq-chat";
import { Button } from "@/components/ui/button";
import {
  AFFILIATE,
  AFFILIATE_JOIN_URL,
  commissionCents,
  usd,
} from "@/lib/affiliate";
import { metaDescription, metaTitle } from "@/lib/meta";
import { CHECKOUT_PRODUCTS } from "@/lib/plans";
import { FadeUp } from "../components/fade-up";
import { Earnings, type EarningsPlan } from "./earnings";

const { percent, cookieDays, holdDays, param } = AFFILIATE;

const TITLE = `Affiliate program — earn ${percent}% of net revenue on snapcn sales`;
const DESCRIPTION = `Share snapcn with people who make videos in React. Every sale through your link pays you ${percent}% of net revenue, tracked for ${cookieDays} days.`;
const OG_IMAGE = "/og?v=2";

export const metadata: Metadata = {
  title: metaTitle(TITLE),
  description: metaDescription(DESCRIPTION),
  alternates: { canonical: "/affiliates" },
  openGraph: {
    type: "website",
    url: "/affiliates",
    title: TITLE,
    description: DESCRIPTION,
    siteName: "snapcn",
    images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: TITLE }],
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
    images: [OG_IMAGE],
  },
};

/**
 * Read from `CHECKOUT_PRODUCTS`, the table Dodo is charged from, so a price
 * change moves every number on this page with it. List prices: a sale or a
 * coupon lowers a commission with the price, and the fine print says so rather
 * than this page chasing the banner's window.
 */
const PLANS: EarningsPlan[] = [
  {
    name: "Pro",
    cents: CHECKOUT_PRODUCTS.everything_annual.cents,
    terms: "Annual plan — paid on the first year",
  },
  {
    name: "Lifetime",
    cents: CHECKOUT_PRODUCTS.lifetime.cents,
    terms: "One payment — paid in full",
  },
  {
    name: "Commercial",
    cents: CHECKOUT_PRODUCTS.commercial.cents,
    terms: "One payment, five seats — paid in full",
  },
];

/** The site's section heading: large, regular weight, tight. */
const H2 =
  "text-pretty font-normal font-sans text-[clamp(2rem,3.6vw,2.75rem)] text-foreground leading-[1.1] tracking-[-0.03em]";
const LEAD = "mt-4 max-w-xl text-pretty text-body-lg text-current/70";

/** The home page's step cards (what-you-get.tsx): a picture over two lines. */
const CARD = "flex flex-col overflow-hidden rounded-[5px] bg-muted";
const PANEL =
  "w-full max-w-[20rem] rounded-[16px] border border-border/60 bg-background p-4 text-sm shadow-[0_1px_2px_rgba(0,0,0,0.04)]";

const LINK = (
  <>
    snapcn.dev/?{param}=<span className="text-primary">yourname</span>
  </>
);

function LinkVisual() {
  return (
    <div className={PANEL}>
      <p className="text-current/60 text-xs">Your link</p>
      <div className="mt-2 flex items-center gap-2 rounded-[10px] border border-border bg-muted/40 py-1.5 pr-1.5 pl-3">
        <span className="truncate font-mono text-[0.8125rem]">{LINK}</span>
        <span className="ml-auto flex shrink-0 items-center gap-1 rounded-[7px] bg-foreground px-2 py-1 font-medium text-background text-xs">
          <Copy className="size-3" aria-hidden />
          Copy
        </span>
      </div>
      <p className="mt-4 text-current/60 text-xs">Works on any page</p>
      <div className="mt-2 flex flex-wrap gap-1.5 font-mono text-[0.75rem] text-current/70">
        {["/", "/docs/components", "/blogs"].map((path) => (
          <span key={path} className="rounded-[6px] bg-muted px-2 py-0.5">
            {path}
          </span>
        ))}
      </div>
    </div>
  );
}

function ShareVisual() {
  return (
    <div className={PANEL}>
      <div className="flex items-center gap-2.5">
        <span className="size-8 shrink-0 rounded-full bg-gradient-to-br from-primary/60 to-primary" />
        <span className="flex flex-col gap-1.5">
          <span className="h-2 w-20 rounded-full bg-foreground/80" />
          <span className="h-2 w-14 rounded-full bg-muted" />
        </span>
      </div>
      <p className="mt-3 text-pretty leading-snug">
        Made our whole launch video with these in an afternoon.
      </p>
      <p className="mt-2 w-fit rounded-[6px] border border-primary/30 bg-primary/5 px-2 py-0.5 font-mono text-[0.75rem] text-foreground">
        {LINK}
      </p>
      <div className="mt-3 flex items-center gap-1.5 border-border/60 border-t pt-3 text-current/60 text-xs tabular-nums">
        <MousePointerClick className="size-3.5" aria-hidden />
        214 clicks · 9 sales
      </div>
    </div>
  );
}

function PayoutVisual() {
  const rows = PLANS.map((p) => ({
    name: p.name,
    cents: commissionCents(p.cents),
  }));
  const total = rows.reduce((sum, r) => sum + r.cents, 0);
  return (
    <div className={PANEL}>
      <div className="flex items-center justify-between">
        <span className="font-medium">Payout</span>
        <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
          Paid
        </span>
      </div>
      <ul className="mt-3 space-y-2 border-border/60 border-t pt-3">
        {rows.map((r) => (
          <li key={r.name} className="flex justify-between">
            <span className="text-current/60">{r.name}</span>
            <span className="tabular-nums">+{usd(r.cents)}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-baseline justify-between border-border/60 border-t pt-3">
        <span className="text-current/60">This month</span>
        <span className="font-semibold text-lg tabular-nums tracking-tight">
          {usd(total)}
        </span>
      </div>
    </div>
  );
}

const STEPS = [
  {
    title: "Get your link",
    body: "Join in a minute and pick your code. It works on every snapcn page, so link straight to whatever you are showing.",
    Visual: LinkVisual,
  },
  {
    title: "Share it where you build",
    body: `A post, a tutorial, a newsletter, a launch. The link remembers each visitor for ${cookieDays} days, so they can buy later.`,
    Visual: ShareVisual,
  },
  {
    title: "Get paid monthly",
    body: `Every click and sale is in your dashboard as it happens. A sale is payable after ${holdDays} days and goes out with the month's payout.`,
    Visual: PayoutVisual,
  },
];

const STATS = [
  { value: `${percent}%`, label: "of net revenue on every sale you send" },
  { value: `${cookieDays} days`, label: "for a click to turn into a sale" },
  { value: "Monthly", label: `payouts, after a ${holdDays}-day hold` },
];

const TERMS: [string, string][] = [
  [
    "Commission",
    `${percent}% of net revenue: what the customer pays, minus taxes, payment processing fees and any discount`,
  ],
  ["Plans", "Pro (first year), Lifetime and Commercial"],
  [
    "Regional prices",
    `${percent}% of net revenue on what the buyer was charged`,
  ],
  ["Refunds", "Refunded or disputed sales are excluded"],
  ["Tracking", `${cookieDays} days from the click, in the visitor's browser`],
  ["Payable", `${holdDays} days after the sale`],
  ["Payouts", "Monthly, from your affiliate dashboard"],
];

const RULES = [
  "Search ads on “snapcn” or anything that reads like it",
  "Buying through your own link",
  "Coupon sites listing codes we did not give you",
  "Posting the link without saying you are an affiliate",
];

const FAQ = [
  {
    q: "Who can join?",
    a: "Anyone with an audience that makes video in React — creators, educators, agencies, newsletter writers. You do not need to be a customer first.",
  },
  {
    q: "How is a sale matched to me?",
    a: `Your link sets a cookie in the visitor's browser for ${cookieDays} days. If they buy in that browser within that time, on any page, the sale is yours.`,
  },
  {
    q: "What is net revenue?",
    a: `What the customer pays, minus taxes (VAT, GST, sales tax), payment processing fees and any discount applied. Refunded or disputed sales are excluded. Example: a customer pays $199 for Lifetime; after processing fees net revenue is about $188, and you earn about $56.`,
  },
  {
    q: "Do I earn on annual renewals?",
    a: "On the first year's payment. Lifetime and Commercial are single payments, so the commission is paid once, in full.",
  },
  {
    q: "When and how do I get paid?",
    a: `A commission becomes payable ${holdDays} days after the sale, and payouts go out monthly. You set your payout details and see every click and sale in your affiliate dashboard.`,
  },
  {
    q: "Can my audience get a discount?",
    a: "Ask us. For a real audience we will make a code of your own, and sales on it count as yours.",
  },
];

/** The hero's entrance, the same one the home hero uses. */
const RISE =
  "animate-in fade-in slide-in-from-bottom-6 blur-in-8 duration-200 ease-[cubic-bezier(0,0,0.58,1)] fill-mode-backwards motion-reduce:animate-none";

export default function AffiliatesPage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden pt-16 pb-20 sm:pt-24 sm:pb-28">
        <div aria-hidden className="absolute inset-0 -z-10">
          <div className="absolute inset-0 bg-grid-fade" />
          <div className="absolute inset-x-0 top-0 h-[420px] bg-[radial-gradient(60%_100%_at_50%_0%,var(--color-muted),transparent_70%)] opacity-70" />
        </div>
        <div className="section flex flex-col items-center text-center">
          <p
            className={`${RISE} inline-flex items-center gap-2 rounded-full border border-border bg-card py-1 pr-3 pl-1.5 text-sm shadow-[var(--shadow-card)]`}
          >
            <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary text-xs">
              {percent}%
            </span>
            The snapcn affiliate program
          </p>
          <h1
            className={`${RISE} mt-6 text-balance font-normal font-sans text-[clamp(3rem,7vw,6rem)] text-foreground leading-none tracking-[-0.045em] delay-[60ms]`}
          >
            Share snapcn.
            <br />
            Keep {percent}%.
          </h1>
          <p
            className={`${RISE} mt-6 max-w-xl text-balance text-body-lg text-current/70 delay-[120ms]`}
          >
            Recommend the components you already make videos with. Every sale
            through your link pays you {percent}% of net revenue — tracked for{" "}
            {cookieDays} days, paid out monthly.
          </p>
          <div
            className={`${RISE} mt-8 flex flex-col gap-3 delay-[180ms] sm:flex-row`}
          >
            <Button
              size="lg"
              className="h-11 gap-2 px-6 text-sm"
              nativeButton={false}
              render={<Link href={AFFILIATE_JOIN_URL} />}
            >
              Become an affiliate
              <ArrowRight className="size-4" aria-hidden="true" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-11 px-6 text-sm"
              nativeButton={false}
              render={<Link href="#earnings" />}
            >
              See what you'd earn
            </Button>
          </div>

          <dl
            className={`${RISE} mt-16 grid w-full max-w-3xl grid-cols-1 divide-y divide-border border-border border-y delay-[240ms] sm:grid-cols-3 sm:divide-x sm:divide-y-0`}
          >
            {STATS.map(({ value, label }) => (
              <div key={value} className="px-6 py-6">
                <dt className="sr-only">{label}</dt>
                <dd className="font-normal text-3xl text-foreground tracking-[-0.03em]">
                  {value}
                </dd>
                <dd className="mt-1 text-current/60 text-sm">{label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>

      <div className="section">
        {/* ── Earnings ───────────────────────────────────────────────── */}
        <section id="earnings" className="scroll-mt-24 pb-24 sm:pb-32">
          <FadeUp>
            <h2 className={H2}>What a referral is worth</h2>
            <p className={LEAD}>
              {percent}% of net revenue: what the buyer pays, minus taxes and
              payment processing fees. Pick the plan they buy and how many you
              send.
            </p>
          </FadeUp>
          <FadeUp delay={0.08} className="mt-10">
            <Earnings plans={PLANS} />
            <p className="mt-4 text-pretty text-current/60 text-sm">
              A sale price or a coupon lowers the commission with the price.
              Regional prices pay {percent}% of net revenue on what was charged.
            </p>
          </FadeUp>
        </section>

        {/* ── How it works ───────────────────────────────────────────── */}
        <section className="pb-24 sm:pb-32">
          <FadeUp>
            <h2 className={H2}>Three steps, then it runs itself</h2>
            <p className={LEAD}>
              No approval queue for your posts, no quota to hit. Share when you
              have something worth showing.
            </p>
          </FadeUp>
          <FadeUp delay={0.08} className="mt-10">
            <ol className="grid gap-4 md:grid-cols-3">
              {STEPS.map(({ title, body, Visual }, i) => (
                <li key={title} className={CARD}>
                  <div className="flex h-64 items-center justify-center px-6">
                    <Visual />
                  </div>
                  <div className="px-6 pt-2 pb-8 sm:px-8">
                    <span className="font-mono text-current/50 text-xs tabular-nums">
                      0{i + 1}
                    </span>
                    <h3 className="mt-2 font-medium text-[1.5rem] leading-tight tracking-[-0.02em]">
                      {title}
                    </h3>
                    <p className="mt-3 max-w-[34ch] text-pretty text-current/70 leading-relaxed">
                      {body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </FadeUp>
        </section>

        {/* ── Terms ──────────────────────────────────────────────────── */}
        <section className="pb-24 sm:pb-32">
          <FadeUp>
            <div className="grid gap-10 md:grid-cols-5 md:gap-16">
              <div className="md:col-span-2">
                <h2 className={H2}>The fine print, all of it</h2>
                <p className="mt-4 max-w-sm text-pretty text-current/70 leading-relaxed">
                  Everything that decides what you are paid, on one screen.
                  Nothing else applies.
                </p>
              </div>
              <div className="md:col-span-3">
                <dl className="border-border border-t">
                  {TERMS.map(([term, value]) => (
                    <div
                      key={term}
                      className="grid gap-1 border-border border-b py-4 sm:grid-cols-[10rem_1fr] sm:gap-6"
                    >
                      <dt className="text-current/60 text-sm">{term}</dt>
                      <dd className="text-pretty text-sm">{value}</dd>
                    </div>
                  ))}
                </dl>
                <p className="mt-10 font-medium text-sm">Not allowed</p>
                <ul className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  {RULES.map((rule) => (
                    <li
                      key={rule}
                      className="flex items-start gap-2 text-current/70 text-sm"
                    >
                      <span className="mt-px grid size-[18px] shrink-0 place-items-center rounded-md bg-muted">
                        <X className="size-3" strokeWidth={2.5} aria-hidden />
                      </span>
                      <span className="text-pretty">{rule}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-4 text-current/60 text-xs">
                  Break one and the commissions it earned are not paid.
                </p>
              </div>
            </div>
          </FadeUp>
        </section>

        {/* ── FAQ — the home page's layout ───────────────────────────── */}
        <section className="pb-20 sm:pb-28">
          <FadeUp>
            <div className="grid gap-10 md:grid-cols-5 md:gap-16">
              <div className="md:sticky md:top-24 md:col-span-2 md:self-start">
                <h2 className="text-pretty font-normal font-sans text-[clamp(2.25rem,4.6vw,3.5rem)] text-foreground leading-[1.06] tracking-[-0.03em]">
                  Before you share
                </h2>
                <p className="mt-5 max-w-sm text-pretty text-current/70 leading-relaxed">
                  What affiliates ask before they join — how a sale is matched,
                  what is taken out, and when the money lands.
                </p>
              </div>
              <div className="md:col-span-3">
                <FaqChat items={FAQ} />
              </div>
            </div>
          </FadeUp>
        </section>

        <Cta
          title="Start earning"
          body={
            <>
              Free to join. {percent}% of net revenue on every sale,
              <br />
              paid out monthly.
            </>
          }
          href={AFFILIATE_JOIN_URL}
          label="Become an affiliate"
        />
      </div>
    </>
  );
}
