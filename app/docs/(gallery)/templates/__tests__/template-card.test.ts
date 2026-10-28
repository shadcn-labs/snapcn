/**
 * Templates are visible to everyone — film and install command — and only the
 * registry refuses an unpaid install. The card's one job per plan: upsell
 * without the Pro catalogue, nothing extra with it.
 *
 * Run with:  pnpm vitest run "app/docs/(gallery)/templates"
 */

import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { TemplateCard } from "@/components/docs/gallery/template-card";
import { REELS } from "@/components/docs/gallery/template-reels";

const reel = REELS[0];
const html = (props: Partial<Parameters<typeof TemplateCard>[0]>) =>
  renderToString(
    createElement(TemplateCard, {
      reel,
      install: reel.install,
      unlocked: false,
      ...props,
    }),
  );

describe("template card", () => {
  it("unpaid: the film and the real install, plus the unlock", () => {
    const out = html({});
    expect(out).toContain(`templates-wip/${reel.slug}-${reel.v}.mp4`);
    expect(out).toContain(`add @snapcn/${reel.install}`);
    expect(out).toContain("Unlock with Pro");
    expect(out).toContain("Installs with a Pro key");
  });

  it("paid: the same card, no upsell", () => {
    const out = html({ unlocked: true });
    expect(out).toContain(`add @snapcn/${reel.install}`);
    expect(out).not.toContain("Unlock with Pro");
    expect(out).not.toContain("Installs with a Pro key");
  });

  it("without a registry item: no command that would 404", () => {
    const out = html({ install: null });
    expect(out).not.toContain("@snapcn/");
    expect(out).toContain("lands here when");
  });
});
