import "server-only";
import type { ControlConfig } from "@/lib/customizer-config";
import { readStudioPro } from "@/lib/server/pro-registry";
import { isHexColor } from "@/lib/video-editor/types";
import { describeControls, lookup as freeLookup } from "./catalog";
import type { CatalogEntry, Lookup } from "./ops";

/**
 * The Pro scenes the studio's AI may cast — for a session whose plan unlocks
 * components, and nobody else. Built from `pro-meta.json` (controls, length,
 * backdrop: metadata, no code), which lives with the private files and is
 * read here on the server, so a free user's catalog never even names them.
 */

interface ProMeta {
  slug: string;
  name: string;
  description: string;
  controls: ControlConfig | null;
  durationInFrames: number | null;
  fps: number;
  previewBackdrop: { type?: string; value?: string } | null;
}

let cache: Promise<ProMeta[]> | null = null;

function proMeta(): Promise<ProMeta[]> {
  cache ??= readStudioPro("pro-meta.json")
    .then((raw) => (raw ? (JSON.parse(raw) as ProMeta[]) : []))
    .catch(() => []);
  return cache;
}

export interface ProCatalog {
  lookup: Lookup;
  /** Catalog lines for the model, or "" when this server has no Pro script. */
  prompt: string;
}

let built: Promise<ProCatalog> | null = null;

/** Free + Pro, for an entitled session. Built once per process. */
export function proCatalog(): Promise<ProCatalog> {
  built ??= proMeta().then((meta) => {
    const entries = new Map<string, CatalogEntry>();
    const lines: string[] = [];
    for (const m of meta) {
      if (!m.controls || !m.durationInFrames) continue;
      const backdrop =
        m.previewBackdrop?.type === "color" &&
        isHexColor(m.previewBackdrop.value)
          ? m.previewBackdrop.value
          : undefined;
      entries.set(m.slug, {
        controls: m.controls,
        durationInFrames: m.durationInFrames,
        backdrop,
      });
      const secs = (m.durationInFrames / (m.fps || 30)).toFixed(1);
      lines.push(
        `- ${m.slug} — ${m.name} [pro, ${secs}s]: ${m.description}\n  props: ${describeControls(m.slug, m.controls)}`,
      );
    }
    return {
      lookup: (slug) => freeLookup(slug) ?? entries.get(slug),
      prompt: lines.length
        ? `\n\nPro scenes — this user's plan includes them. They are the most polished scenes in the library: prefer one wherever it fits the beat. They are not theme-measured, so keep the video's mode in mind when picking (a scene described as dark suits a dark video).\n${lines.join("\n")}`
        : "",
    };
  });
  return built;
}
