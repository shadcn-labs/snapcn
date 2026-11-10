/**
 * What shipped that is not a component — a new tab, a page, a change in how
 * something works — by day. The changelog lists these beside the components
 * that landed the same day, so it records the site and not only the catalogue.
 *
 * User-facing only, one line each, newest first. Components never go here:
 * they date themselves through their own `added`.
 */
export const SITE_NOTES: { date: string; notes: string[] }[] = [
  {
    date: "2026-11-10",
    notes: [
      "Five more templates: Launch film, Ask snapcn, What's new, App launch and Why switch.",
    ],
  },
  {
    date: "2026-10-21",
    notes: [
      "Cursor & Clicks and Transitions open in the gallery.",
      "Every cursor component draws the site's own pointer.",
      "Templates: all five previewed ahead of their 25 October release, when they unlock for Pro.",
      "Plugins for Claude Code, Cursor and Gemini CLI: the agent skills, and the MCP server for Pro.",
      "Docs pages read long-form, with an On this page list beside them.",
      "Every page shares one width, the navbar's.",
    ],
  },
  {
    date: "2026-10-20",
    notes: [
      "The navbar on every page, new home sections and a countdown to the early-bird deadline.",
    ],
  },
  {
    date: "2026-10-19",
    notes: [
      "Early-bird prices extended to 25 October. Templates land five on 25 October and five more on 10 November.",
      "Sixteen new posts on the wall of love.",
    ],
  },
  {
    date: "2026-10-15",
    notes: ["The New shelf ranks the whole catalogue, Pro included."],
  },
  {
    date: "2026-10-12",
    notes: [
      "Pro components play above the plans on the pricing page.",
      "Adding a Pro component without a key installs a watermarked preview instead of nothing.",
      "Every component type-checks in a stock Remotion project.",
    ],
  },
  {
    date: "2026-10-11",
    notes: ["snapcn is a Shadcn Labs project."],
  },
  {
    date: "2026-10-08",
    notes: ["A new landing page."],
  },
];
