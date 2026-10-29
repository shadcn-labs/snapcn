/**
 * The components the studio's AI may place, and how they're described to it.
 *
 * Exactly the editor library's set — free gallery items that have a config — so
 * the AI can never put something on the timeline a person could not have added
 * by hand, and a Pro item (which has no registry entry to render) never appears.
 */

import type { ControlType } from "@/lib/customizer-config";
import { GALLERY_ITEMS, slugFromHref } from "@/lib/gallery-data";
import { isHexColor } from "@/lib/video-editor/types";
import { CONFIGS } from "@/registry/__configs__";
import type { CatalogEntry, Lookup } from "./ops";

const ITEMS = GALLERY_ITEMS.filter((it) => !it.pro)
  .map((it) => ({ ...it, slug: slugFromHref(it.href) }))
  .filter((it) => Boolean(CONFIGS[it.slug]));

const ENTRIES = new Map<string, CatalogEntry>(
  ITEMS.map((it) => {
    const config = CONFIGS[it.slug];
    const backdrop = config.previewBackdrop;
    return [
      it.slug,
      {
        controls: config.controls,
        durationInFrames: config.durationInFrames,
        backdrop:
          backdrop?.type === "color" && isHexColor(backdrop.value)
            ? backdrop.value
            : undefined,
      },
    ];
  }),
);

export const lookup: Lookup = (slug) => ENTRIES.get(slug);

/** One control as the model reads it: `key (type …) = default`. */
function describeControl(key: string, c: ControlType): string {
  switch (c.type) {
    case "text":
      return `${key} (text) = ${JSON.stringify(c.default.slice(0, 60))}`;
    case "image":
      return `${key} (image https URL)`;
    case "number":
    case "number-input":
      return `${key} (number ${c.min}–${c.max}) = ${c.default}`;
    case "color":
      return `${key} (hex colour) = ${c.default}`;
    case "select":
      return `${key} (one of ${c.options.join("|")}) = ${c.default}`;
    case "boolean":
      return `${key} (boolean) = ${c.default}`;
  }
}

/**
 * The catalog as prompt text. Built once per process: it only changes on
 * deploy, and a stable string is what lets the provider cache the prefix.
 */
export const CATALOG_PROMPT = ITEMS.map((it) => {
  const config = CONFIGS[it.slug];
  const controls = Object.entries(config.controls)
    .map(([key, c]) => describeControl(key, c))
    .join("; ");
  const secs = (config.durationInFrames / config.fps).toFixed(1);
  return `- ${it.slug} — ${it.name} [${it.category}, ${secs}s]: ${it.description}\n  props: ${controls}`;
}).join("\n");
