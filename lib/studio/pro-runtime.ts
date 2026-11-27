import type { ComponentType } from "react";
import * as React from "react";
import { useSyncExternalStore } from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as ReactDOM from "react-dom";
import * as Remotion from "remotion";
import type { ComponentConfig } from "@/lib/customizer-config";
import * as SnapCnUI from "@/lib/snap-cn-ui";

/**
 * Pro scenes, loaded at runtime from the private script that
 * `scripts/build-studio-pro.mts` builds.
 *
 * Why at runtime: Pro source is not in the public repo, so it is in neither
 * the site's bundle nor the renderer's. The one script is served only to a
 * session whose plan unlocks components, or to our renderer with a signed,
 * short-lived token (`/api/studio/pro/[file]`). The Player and the export load
 * the same file, so a preview and its MP4 can't disagree.
 *
 * The script shares this page's modules instead of carrying its own: two
 * Reacts break every hook, and a second `snap-cn-ui` would miss the theme the
 * timeline provides. It reads them from `globalThis.__snapcnShared`, keyed by
 * import specifier — the list must match `SHARED` in the build script.
 */

export interface ProEntry {
  Component: ComponentType<Record<string, unknown>>;
  config: ComponentConfig;
}

declare global {
  // eslint-disable-next-line no-var
  var __snapcnShared: Record<string, unknown> | undefined;
  // eslint-disable-next-line no-var
  var __snapcnPro: Record<string, ProEntry> | undefined;
}

const loaded: Record<string, ProEntry> = {};
let pending: Promise<void> | null = null;
let version = 0;
const listeners = new Set<() => void>();

export const proEntry = (slug: string): ProEntry | undefined => loaded[slug];

/** Load the Pro script once per page. Resolves when its scenes are registered. */
export function loadPro(url: string): Promise<void> {
  if (pending) return pending;
  if (typeof document === "undefined") return Promise.resolve();
  globalThis.__snapcnShared = {
    react: React,
    "react/jsx-runtime": JsxRuntime,
    "react-dom": ReactDOM,
    remotion: Remotion,
    "@/lib/snap-cn-ui": SnapCnUI,
  };
  pending = new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.src = url;
    script.async = true;
    script.onload = () => {
      Object.assign(loaded, globalThis.__snapcnPro ?? {});
      version++;
      for (const l of listeners) l();
      resolve();
    };
    script.onerror = () => {
      pending = null;
      script.remove();
      reject(new Error("Pro scenes couldn't load"));
    };
    document.head.appendChild(script);
  });
  return pending;
}

/** Re-renders the caller when Pro scenes arrive. */
export function useProVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => version,
    () => 0,
  );
}
