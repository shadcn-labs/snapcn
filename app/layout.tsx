import { RootProvider } from "fumadocs-ui/provider/next";
import type { Metadata } from "next";
import { Caveat, Geist, Geist_Mono } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { NudgeCard } from "@/components/nudge-card";
import { SaleBanner } from "@/components/sale-banner";
import { cn } from "@/lib/utils";
import { PostHogProvider } from "./posthog-provider";
import { SnapCnThemeBridge } from "./snap-cn-theme-bridge";
import { ThemeShortcut } from "./theme-shortcut";

/**
 * `preload: false` on everything below is deliberate and measured.
 *
 * next/font emits a blocking `<link rel="preload">` per weight on *every* page
 * that mounts this layout — 430KB of woff2 on the landing page, more than all of
 * its JS. None of these four faces paint a single glyph there. Without preload
 * they still load, on the pages that actually use them, at the moment a rule
 * asks for one.
 */
// The site's face, as on ruixen.com: Geist, bound to `--font-sans` the way
// ruixen binds it. next/font's class on <html> is unlayered, so it beats any
// `--font-sans` in globals.css — this is the one place the site face is set.
const siteSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  preload: false,
});

// The site's face, as on ruixen.com: Geist for everything, Geist Mono for
// code (`--font-sans` / `--font-mono` in globals.css point here). It is also
// the face the registry's scenes render through, so the name must stay.
const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  preload: false,
});

// Not preloaded any more: nothing on the first screen is set in it (the hero's
// install button, which was, is gone), and a preload competes with the
// stylesheet for the same connection.
const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  preload: false,
});

// Handwritten face for the gallery sidebar's "new" scribble only.
const caveat = Caveat({
  variable: "--font-scribble",
  weight: "600",
  subsets: ["latin"],
  preload: false,
});

const SITE_URL = "https://snapcn.dev";
/**
 * The title is the one line that has to carry the query. "Cinematic video
 * components for React" was accurate and unsearchable — it omitted both terms
 * anyone actually types, *Remotion* and *shadcn*. This is 61 characters, so it
 * survives a SERP intact.
 */
const SITE_TITLE = "snapcn — Remotion components, installed with shadcn";
const SITE_DESCRIPTION =
  "A shadcn registry of Remotion components for React video: text animations, captions, device mockups and full scenes. Install with the CLI, own the code. MIT.";

export const metadata: Metadata = {
  // Resolves the relative `/og` card URLs below into an absolute URL for crawlers.
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: "%s · snapcn",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "snapcn",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    locale: "en_US",
    images: [
      {
        url: "/og?v=2",
        width: 1200,
        height: 630,
        alt: SITE_TITLE,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    // `site` is the product's account, `creator` the author's — they are not
    // the same handle, and X shows the site one on the card.
    site: "@snapcndev",
    creator: "@SriNath693",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: ["/og?v=2"],
  },
};

/**
 * Browser page translation (Chrome/Google Translate, Edge, Safari) swaps each
 * text node for a `<font>` it owns. The next time React inserts or removes
 * beside one, it asks a parent that no longer holds the child and throws
 * `NotFoundError: insertBefore` / `removeChild` — the tree unmounts and the
 * page goes blank. ~25% of visitors browse in zh-CN, pt-BR and the like; 9 hit
 * it in Sep 2026, one on the pricing page's buy click (a lost sale).
 *
 * The guard skips a removal of a node that is already gone, and appends an
 * insert whose anchor is gone (dropping it would hide the new node). React's
 * workaround from facebook/react#11538, except for that append.
 *
 * ponytail: under translation a later text update can miss (React writes to the
 * orphaned node) and an appended node can land out of order. Wrap such text in
 * its own <span> if either ever shows up.
 */
const TRANSLATE_GUARD = `(function(){var P=Node.prototype,r=P.removeChild,i=P.insertBefore;
P.removeChild=function(c){return c.parentNode!==this?c:r.apply(this,arguments)};
P.insertBefore=function(n,b){return b&&b.parentNode!==this?i.call(this,n,null):i.apply(this,arguments)};})()`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      // Tells Next to suspend `scroll-behavior: smooth` during route
      // transitions, so a navigation jumps to the top instead of animating.
      data-scroll-behavior="smooth"
      className={cn(
        "h-full",
        "antialiased",
        geistSans.variable,
        geistMono.variable,
        caveat.variable,
        siteSans.variable,
        "font-sans",
      )}
    >
      <head>
        {/* Must run before hydration — see TRANSLATE_GUARD. */}
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: static constant, no user input
          dangerouslySetInnerHTML={{ __html: TRANSLATE_GUARD }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <PostHogProvider>
            <NuqsAdapter>
              <RootProvider
                theme={{
                  defaultTheme: "system",
                  enableSystem: true,
                }}
                // The search dialog is lazy, but `preload` (on by default)
                // mounts it closed on every page — which loads it, and the
                // search index client with it: three chunks, ~300KB, on the
                // critical path of pages nobody searches from. Off, it loads
                // on first open.
                search={{ preload: false }}
              >
                <ThemeShortcut />
                <SaleBanner />
                <NudgeCard />
                <SnapCnThemeBridge>{children}</SnapCnThemeBridge>
              </RootProvider>
            </NuqsAdapter>
          </PostHogProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
