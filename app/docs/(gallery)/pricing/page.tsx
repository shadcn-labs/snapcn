import type { Metadata } from "next";
import Link from "next/link";
import { Cta } from "@/app/(home)/components/sections/cta";
import { FeaturedQuote } from "@/app/(home)/components/sections/featured-quote";
import { auth } from "@/auth";
import { ComponentCardGrid } from "@/components/docs/component-card-grid";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { EarlyBirdStrip } from "@/components/early-bird";
import { NewsletterForm } from "@/components/newsletter-form";
import { DOCS_PAGE_META } from "@/config/site";
import { GALLERY_COUNT, PRO_GALLERY_ITEMS } from "@/lib/gallery-data";
import { metaDescription, metaTitle } from "@/lib/meta";
import { PageJsonLd } from "@/lib/page-json-ld";
import { PRO_SAMPLE } from "@/lib/plans";
import { proDemoPoster, proDemoSrc } from "@/lib/pro-demos";
import { RenderedDemo } from "@/lib/rendered-demos";
import { planFor } from "@/lib/server/entitlements";
import { docsBreadcrumb } from "@/lib/structured-data";
import { cn } from "@/lib/utils";
import { PricingPlans } from "./pricing-plans";
import { PRICING_INTRO, pricing } from "./tiers";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.pricing;
const OG_IMAGE = "/og/pricing?v=2";

export const metadata: Metadata = {
  title: metaTitle(DOCS_PAGE_META.pricing.seoTitle ?? TITLE),
  description: metaDescription(DESCRIPTION),
  alternates: { canonical: "/docs/pricing" },
  openGraph: {
    type: "website",
    url: "/docs/pricing",
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

const jsonLd = [docsBreadcrumb(TITLE, "/docs/pricing")];

/**
 * Three Pro demos *above* the plans. The page already played all of them —
 * fifty-odd cards at the bottom — but the median visitor scrolls 19% of it and
 * 65 of 91 never pass halfway (PostHog, 30 days to Oct 12), so almost nobody
 * deciding at the plans had seen what Pro is. These are the scenes the Labs
 * launch video is cut from, so a visitor arriving from that post sees what they
 * just watched.
 */
const SHOWCASE = ["cross-out", "library-flight", "lockup-reveal"];

export default async function PricingPage({
  searchParams,
}: {
  searchParams: Promise<{ country?: string }>;
}) {
  const { country } = await searchParams;
  const session = await auth().catch(() => null);
  const userId = session?.user?.id ?? null;
  // Named by the plan as bought (`PlanTier`), so a Lifetime buyer's card is the
  // one marked theirs, and the cheaper ones read as included rather than for
  // sale. Same answer the account menu and /account give.
  const [{ plan, tier }, { tiers, footnote }] = await Promise.all([
    planFor(userId),
    pricing({ testCountry: country }),
  ]);
  const currentPlan = plan === "anonymous" ? "anonymous" : tier;
  const showcase = SHOWCASE.flatMap((slug) => {
    const src = proDemoSrc(slug);
    const item = PRO_GALLERY_ITEMS.find((i) => i.href.endsWith(`/${slug}`));
    return src && item ? [{ slug, src, item }] : [];
  });

  return (
    <GalleryFrame>
      <PageJsonLd graph={jsonLd} path="/docs/pricing" />
      {/* The account menu, like every other gallery page. Without it the one
          page that says "Your plan" had no way to sign in or out. */}
      <DocsTopBar />
      <div className="w-full py-16 lg:py-24">
        <div className="flex flex-col items-center">
          <FeaturedQuote className="mb-8" />
          <h1 className="text-center font-normal text-4xl text-foreground leading-[1.06] tracking-[-0.03em] sm:text-5xl lg:text-6xl">
            {PRICING_INTRO.title}
          </h1>
          <p className="mt-4 max-w-md text-balance text-center text-lg text-muted-foreground md:text-xl">
            {PRICING_INTRO.description}
          </p>
          <EarlyBirdStrip className="mt-6" withLockIn />
        </div>

        {showcase.length > 0 ? (
          <div className="mt-10 grid grid-cols-1 gap-4 sm:grid-cols-3 lg:mt-12">
            {showcase.map(({ slug, src, item }, i) => (
              <Link
                key={slug}
                href={item.href}
                aria-label={`${item.name} — Pro component`}
                // One on a phone: three stacked would push the plans a screen down.
                className={cn(
                  "surface-card relative aspect-video w-full overflow-hidden rounded-xl",
                  i > 0 && "hidden sm:block",
                )}
              >
                <RenderedDemo
                  src={src}
                  poster={proDemoPoster(slug) ?? undefined}
                />
              </Link>
            ))}
          </div>
        ) : null}

        {/* `#plans` and `#free` are addresses, not decoration: the 402, the
            docs pages and the old `/pro` links all land on them. This is the
            one pricing page — `/pro` forwards here. */}
        <div id="plans" className="mt-10 scroll-mt-24 lg:mt-14">
          <PricingPlans
            tiers={tiers}
            currentPlan={currentPlan}
            footnote={footnote}
          />
        </div>

        {/* The second exit, for everyone who will not buy today: one Pro
            component for a confirmed address. Moved here from `/pro`. */}
        <div id="free" className="mt-20 scroll-mt-24">
          <Cta
            title={`Not ready? Get ${PRO_SAMPLE.title} free.`}
            body="Confirm your address and the install command for one Pro component is yours — on the page and in your inbox. At most one email a week after that, never sponsored."
          >
            <NewsletterForm
              defaultSource="pro-sample"
              id="pro-sample-email"
              buttonLabel={`Send me ${PRO_SAMPLE.title}`}
            />
          </Cta>
        </div>

        {PRO_GALLERY_ITEMS.length > 0 ? (
          <>
            <h2 className="mt-20 text-center font-medium text-foreground text-sm tracking-[-0.01em]">
              Everything in Pro
            </h2>
            <ComponentCardGrid
              items={PRO_GALLERY_ITEMS.map((i) => ({
                name: i.name,
                description: i.description,
                status: "stable" as const,
                href: i.href,
                pro: true,
              }))}
            />
            <p className="mx-auto mt-6 max-w-[52ch] text-pretty text-center text-muted-foreground text-sm">
              The other {GALLERY_COUNT} snapcn components are free and MIT.
            </p>
          </>
        ) : null}

        {/* The question every developer reading this page is actually asking.
            Answering it plainly is cheaper than having it asked in a Show HN
            thread — and the answer is genuinely good for us: the components
            being free is why anybody is on this page at all. */}
        <p className="mx-auto mt-16 max-w-2xl text-center text-muted-foreground text-xs leading-relaxed">
          The free components are MIT and always will be — install them, render
          locally with <code>npx remotion render</code>, and you never owe us
          anything. What Pro buys is the Pro catalogue, the MCP server, and our
          machines doing the rendering without a mark.
        </p>
      </div>
    </GalleryFrame>
  );
}
