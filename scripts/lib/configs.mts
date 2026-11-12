import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import type { ComponentConfig } from "../../lib/customizer-config.ts";
import { tsconfigWebpackAlias } from "../tsconfig-webpack-alias.mts";

const REPO = new URL("../../", import.meta.url);

/**
 * `registry/__configs__.ts` is the driver: it is where SHARED_CONTROLS is merged
 * and the MIN_SPEED_ONE overrides are applied, so it is the only place that
 * knows a component's real runtime controls. Node resolves neither the `@/`
 * alias nor extensionless relative imports; teach it both, exactly as
 * `snapcn-mcp/scripts/build-manifest.mjs` already does.
 */
export async function loadConfigs(): Promise<Record<string, ComponentConfig>> {
  // `node:module`'s `registerHooks` is Node >= 22.15 and this repo is on
  // @types/node 20, so the shape is declared here rather than bumping types the
  // whole app would have to absorb.
  const { registerHooks } = (await import("node:module")) as unknown as {
    registerHooks: (hooks: {
      resolve: (
        spec: string,
        ctx: unknown,
        next: (s: string, c: unknown) => unknown,
      ) => unknown;
      load: (
        url: string,
        ctx: unknown,
        next: (u: string, c: unknown) => unknown,
      ) => unknown;
    }) => void;
  };
  // tsconfig's paths, the same table the Remotion bundler is given:
  // `@/lib/snap-cn-ui` is not `lib/snap-cn-ui`.
  const aliases = tsconfigWebpackAlias(fileURLToPath(REPO));
  registerHooks({
    resolve(spec: string, ctx: unknown, next) {
      const hit = aliases.find((a) =>
        a.onlyModule ? spec === a.name : spec.startsWith(`${a.name}/`),
      );
      if (hit) {
        spec = pathToFileURL(
          hit.onlyModule ? hit.alias : hit.alias + spec.slice(hit.name.length),
        ).href;
      } else if (spec.startsWith("@/")) {
        spec = new URL(spec.slice(2), REPO).href;
      }
      // Extensionless, in the order the bundler tries them: a config that
      // imports its own component (`from "./index"`) reaches a `.tsx`.
      for (const tail of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
        try {
          return next(`${spec}${tail}`, ctx);
        } catch {}
      }
      return next(spec, ctx);
    },
    // Node strips types from `.ts` but has no JSX: a `.tsx` is transpiled here.
    load(url: string, ctx: unknown, next: (u: string, c: unknown) => unknown) {
      if (!url.endsWith(".tsx")) return next(url, ctx);
      const source = readFileSync(new URL(url), "utf8");
      const { outputText } = ts.transpileModule(source, {
        compilerOptions: {
          module: ts.ModuleKind.ESNext,
          target: ts.ScriptTarget.ES2022,
          jsx: ts.JsxEmit.ReactJSX,
          verbatimModuleSyntax: false,
        },
      });
      return { format: "module", source: outputText, shortCircuit: true };
    },
  });
  const mod = await import(new URL("registry/__configs__.ts", REPO).href);
  return mod.CONFIGS;
}
