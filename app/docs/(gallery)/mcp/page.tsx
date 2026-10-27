import type { Metadata } from "next";
import Link from "next/link";
import { DocsTopBar } from "@/components/docs/gallery/docs-top-bar";
import { GalleryFrame } from "@/components/docs/gallery/gallery-frame";
import { DOCS_PAGE_META } from "@/config/site";
import { JOBS, SERVER } from "@/lib/mcp-clients";
import { metaDescription, metaTitle } from "@/lib/meta";
import { PageJsonLd } from "@/lib/page-json-ld";
import { docsBreadcrumb, PUBLISHER, SITE_URL } from "@/lib/structured-data";
import { McpClients, McpJobs } from "./mcp-install";

/**
 * `/docs/mcp` — how to put snapcn inside a coding agent.
 *
 * Modelled on 21st.dev/mcp: one tab per client with the exact line to paste,
 * then the jobs the server does, each as a prompt to hand the agent. The server
 * is `@snapcn/mcp` (the sibling `snapcn-mcp` package). Every snippet comes from
 * `lib/mcp-clients.ts`, which `llms.txt` reads too, so the page and the corpus
 * an agent reads cannot disagree about how to install it.
 *
 * `/mcp` redirects here (next.config.ts): it is the URL people guess.
 */

const { title: TITLE, description: DESCRIPTION } = DOCS_PAGE_META.mcp;
const PATH = "/docs/mcp";
/** Per-page card. `/og` alone is the generic site card. */
const OG_IMAGE = "/og/mcp?v=2";

export const metadata: Metadata = {
  title: metaTitle(DOCS_PAGE_META.mcp.seoTitle ?? TITLE),
  description: metaDescription(DESCRIPTION),
  alternates: { canonical: PATH },
  openGraph: {
    type: "website",
    url: PATH,
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

const jsonLd = [
  {
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}${PATH}#app`,
    name: "snapcn MCP server",
    description: DESCRIPTION,
    url: `${SITE_URL}${PATH}`,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "macOS, Linux, Windows",
    featureList: JOBS.map((job) => job.title),
    installUrl: `https://www.npmjs.com/package/${SERVER.args[1].replace(/@latest$/, "")}`,
    publisher: PUBLISHER,
  },
  docsBreadcrumb(TITLE, PATH),
];

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className="relative">
      <span className="absolute top-0 -left-8 flex size-7 -translate-x-1/2 items-center justify-center rounded-full border border-border bg-background font-mono text-muted-foreground text-xs sm:-left-10">
        {n}
      </span>
      <h2 className="font-medium text-foreground text-lg leading-7">{title}</h2>
      <div className="mt-2">{children}</div>
    </li>
  );
}

export default function McpPage() {
  return (
    <GalleryFrame>
      <PageJsonLd graph={jsonLd} path="/docs/mcp" />
      <DocsTopBar />

      <div className="w-full py-12 sm:py-16">
        <p className="font-mono text-[0.6875rem] font-medium uppercase tracking-[0.14em] text-muted-foreground">
          MCP server
        </p>
        <h1 className="mt-3 max-w-[20ch] text-pretty font-sans text-[clamp(1.75rem,3.6vw,2.75rem)] font-normal leading-[1.08] tracking-[-0.03em] text-foreground">
          Use snapcn in your agent
        </h1>
        <p className="mt-4 max-w-lg text-pretty text-body-lg text-current/70">
          Your agent searches the registry, reads a component&apos;s real props
          and plans the whole video from a one-line brief — then installs the
          components with the shadcn CLI.
        </p>

        {/* A rail of numbered steps rather than three equal cards: the key is a
            sentence, the install is the panel, and the prompts are the payoff. */}
        <ol className="mt-14 space-y-14 border-border border-l pl-8 sm:pl-10">
          <Step n={1} title="Get your key">
            <p className="max-w-lg text-pretty text-current/70">
              Every{" "}
              <Link
                href="/docs/pricing?ref=mcp"
                className="text-foreground underline underline-offset-4"
              >
                Pro
              </Link>{" "}
              plan includes one. Copy it from{" "}
              <Link
                href="/account"
                className="text-foreground underline underline-offset-4"
              >
                your account
              </Link>{" "}
              — it replaces{" "}
              <code className="font-mono text-foreground text-sm">
                YOUR_KEY
              </code>{" "}
              below.
            </p>
          </Step>
          <Step n={2} title="Add the server to your agent">
            <div className="max-w-3xl rounded-2xl border border-border bg-card p-5">
              <McpClients />
            </div>
          </Step>
          <Step n={3} title="Ask for a video">
            <p className="max-w-lg text-pretty text-current/70">
              Paste any prompt below. The agent picks the tool itself.
            </p>
            <div className="mt-6">
              <McpJobs />
            </div>
          </Step>
        </ol>

        <h2 className="mt-24 font-sans text-[clamp(1.5rem,2.8vw,2rem)] font-normal leading-[1.1] tracking-[-0.03em] text-foreground">
          Good to know
        </h2>
        <dl className="mt-6 grid gap-x-10 gap-y-8 border-border border-t pt-8 sm:grid-cols-3">
          <div>
            <dt className="font-medium text-foreground">Runs locally</dt>
            <dd className="mt-1.5 text-muted-foreground text-sm">
              Node 18 or newer. Previews and recording analysis use the Remotion
              CLI already in your project. The live registry is read first, with
              a copy bundled in the package as fallback.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Your key</dt>
            <dd className="mt-1.5 text-muted-foreground text-sm">
              Checked with snapcn.dev on the first call and every 15 minutes
              after. Delete it on your account and the server stops within that.
            </dd>
          </div>
          <div>
            <dt className="font-medium text-foreground">Pro components</dt>
            <dd className="mt-1.5 text-muted-foreground text-sm">
              {/* Two places need the key: the server's arguments (above), which
                  unlock the tools, and the project's components.json, which the
                  shadcn CLI reads to install Pro source. /account shows both. */}
              Show up in search, marked Pro. Installing one also needs your key
              in{" "}
              <code className="font-mono text-foreground text-xs">
                components.json
              </code>{" "}
              —{" "}
              <Link
                href="/account"
                className="text-foreground underline underline-offset-4"
              >
                see your account
              </Link>
              .
            </dd>
          </div>
        </dl>
        <p className="mt-12 text-muted-foreground text-sm">
          Rather teach the agent than run a server?{" "}
          <Link
            href="/docs/getting-started/agent-skill"
            className="text-foreground underline underline-offset-4"
          >
            Install the agent skill
          </Link>
          .
        </p>
      </div>
    </GalleryFrame>
  );
}
