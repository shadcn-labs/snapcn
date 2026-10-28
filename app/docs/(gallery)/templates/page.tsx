import type { Metadata } from "next";
import { Cta } from "@/app/(home)/components/sections/cta";
import { auth } from "@/auth";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { TemplateCard } from "@/components/docs/gallery/template-card";
import { REELS } from "@/components/docs/gallery/template-reels";
import { EarlyBirdStrip } from "@/components/early-bird";
import { PRO_NAMES } from "@/config/catalogue";
import { DOCS_PAGE_META } from "@/config/site";
import { metaDescription, metaTitle } from "@/lib/meta";
import { PageJsonLd } from "@/lib/page-json-ld";
import { PLANS, TEMPLATES_RELEASE_AT } from "@/lib/plans";
import { planFor } from "@/lib/server/entitlements";
import { docsBreadcrumb } from "@/lib/structured-data";

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.templates;
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/templates?v=2";

export const metadata: Metadata = {
  title: metaTitle(DOCS_PAGE_META.templates.seoTitle ?? TITLE),
  description: metaDescription(DESCRIPTION),
  alternates: { canonical: "/docs/templates" },
  openGraph: {
    type: "website",
    url: "/docs/templates",
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

const BUY = "/docs/pricing?ref=templates#plans";

/**
 * The order the page shows them in. `template-reels.ts` is generated, so the
 * order lives here; a template not named below goes to the end.
 */
const ORDER = [
  "Weekly changelog",
  "Feature drop",
  "Startup pitch",
  "Product tour",
  "Product launch",
];
const rank = (title: string) => {
  const i = ORDER.indexOf(title);
  return i === -1 ? ORDER.length : i;
};
const ORDERED = [...REELS].sort((a, b) => rank(a.title) - rank(b.title));

/**
 * `/docs/templates` — what lands on 25 October, and why today is the day to buy.
 *
 * It was a coming-soon card with one button, on the second-busiest docs page
 * (719 people a month, for templates that did not exist yet). Every one of
 * them is already telling us what they want; this page shows them what is
 * coming, prices it, and says plainly what waiting costs — a real date, a real
 * count, and the renewal promise Dodo actually keeps.
 */
export default async function TemplatesPage() {
  // Per request, not per build: who is asking decides what the page may show,
  // and the release is a moment, not a deploy.
  const session = await auth().catch(() => null);
  const { plan } = await planFor(session?.user?.id ?? null);
  const released = Date.now() >= Date.parse(TEMPLATES_RELEASE_AT);
  // Everyone sees the film and the install; paid just drops the upsell.
  const unlocked = plan !== "anonymous" && PLANS[plan].components;

  return (
    <GalleryFrame>
      {/* It was the one route with no schema at all. */}
      <PageJsonLd
        path="/docs/templates"
        graph={[docsBreadcrumb(TITLE, "/docs/templates")]}
      />
      <DocsTopBar />

      <div className="w-full py-12 sm:py-16">
        {/* Hero */}
        <section className="flex flex-col items-center text-center">
          <EarlyBirdStrip />
          <h1 className="mt-8 text-balance font-normal font-sans text-[clamp(2.25rem,5vw,3.75rem)] text-foreground leading-[1.05] tracking-[-0.03em]">
            Video templates
          </h1>
          <p className="mt-4 max-w-xl text-pretty text-current/70">
            Complete videos built from snapcn components, cut to time and ready
            to render. Every template is included in Pro and Lifetime.
          </p>
        </section>

        {/* The templates, one after another */}
        <div className="mt-20 flex flex-col gap-28">
          {/* Film and install command for everyone: the registry, not this
              page, is what refuses an unpaid install. */}
          {ORDERED.map((reel) => (
            <TemplateCard
              key={reel.slug}
              reel={reel}
              install={PRO_NAMES.includes(reel.install) ? reel.install : null}
              unlocked={unlocked}
            />
          ))}
        </div>

        {/* Last call: the site's closing section, with this page's copy.
            Not for someone who already has every template. */}
        {unlocked ? null : (
          <div className="mt-24">
            <Cta
              title="Every template, included in Pro."
              body={<EarlyBirdStrip />}
              href={BUY}
              label={released ? "See the prices" : "See the early-bird prices"}
            />
          </div>
        )}
      </div>
    </GalleryFrame>
  );
}
