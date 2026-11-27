/**
 * Build the Pro components the studio can place, as ONE private script.
 *
 *   node scripts/build-studio-pro.mts
 *
 * Writes `registry/.private/studio/pro.js` and `pro-meta.json` — beside the
 * paid registry items, outside `public/`, never in the repo or the image. In
 * production they go to `PRO_PRIVATE_DIR` with the rest of the private files
 * (see DEPLOYMENT.md) and are served by `/api/studio/pro/[file]` only to a
 * session whose plan unlocks components, or to our own renderer holding a
 * short-lived signed token. Exposure is therefore exactly today's: a paying
 * user can already install every Pro source file with their key.
 *
 * Only the PUBLISHED catalogue (`lib/pro-catalogue.json`) is built — the pro
 * directory also holds unreleased work, which must not ship to anyone.
 *
 * The script is an IIFE. It shares the host page's React, Remotion and the
 * snapcn theme context instead of bundling copies (two Reacts break hooks; a
 * second `@/lib/snap-cn-ui` would miss the video font the timeline provides):
 * those specifiers resolve to `globalThis.__snapcnShared[specifier]`, which
 * `lib/studio/pro-runtime.ts` fills before loading it. Everything else (fonts,
 * transitions, configs) is bundled.
 */
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build, type Plugin } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const proDir = path.join(root, "registry", "snap-cn-pro");
const outDir = process.env.PRO_PRIVATE_DIR
  ? path.join(path.resolve(process.env.PRO_PRIVATE_DIR), "studio")
  : path.join(root, "registry", ".private", "studio");

/** Module specifiers the host provides. Must match `SHARED` in pro-runtime. */
const SHARED = [
  "react",
  "react/jsx-runtime",
  "react-dom",
  "remotion",
  "@/lib/snap-cn-ui",
];

const pascal = (s: string) =>
  s.replace(/(^|-)([a-z0-9])/g, (_, __, c: string) => c.toUpperCase());
const camel = (s: string) => {
  const p = pascal(s);
  return p[0].toLowerCase() + p.slice(1);
};

const catalogue = JSON.parse(
  readFileSync(path.join(root, "lib", "pro-catalogue.json"), "utf8"),
) as { name: string; title: string; description: string }[];

// The barrel is the source of truth for which export is which; take only
// published names that it actually registers.
const barrel = readFileSync(path.join(proDir, "__index__.tsx"), "utf8");
const names = [...new Set(catalogue.map((c) => c.name))]
  .filter((n) => barrel.includes(`"${n}": {`));
const skipped = catalogue.map((c) => c.name).filter((n) => !names.includes(n));

/**
 * Each component's export and config names, read off the barrel's own entry
 * and import lines — not derived from the slug (pixel-peak breaks the rule).
 */
function exportsFor(n: string): {
  component: string;
  config: string;
  from: string;
  configFrom: string;
  componentIsDefault: boolean;
} {
  const block = barrel.match(
    new RegExp(`"${n}": \\{\\s*Component: (\\w+)[\\s\\S]*?config: (\\w+)`),
  );
  if (!block) throw new Error(`no barrel entry for ${n}`);
  const [, component, config] = block;
  const named = (id: string) =>
    barrel.match(new RegExp(`import \\{[^}]*\\b${id}\\b[^}]*\\} from "([^"]+)"`))?.[1];
  const byDefault = (id: string) =>
    barrel.match(new RegExp(`import ${id} from "([^"]+)"`))?.[1];
  const from = named(component) ?? byDefault(component);
  const configFrom = named(config);
  if (!from || !configFrom) throw new Error(`no import for ${n}`);
  return {
    component,
    config,
    from,
    configFrom,
    componentIsDefault: !named(component),
  };
}

const resolved = names.map((n) => ({ n, ...exportsFor(n) }));
const entry = [
  ...resolved.map(
    (r) =>
      `${r.componentIsDefault ? `import C_${camel(r.n)}` : `import { ${r.component} as C_${camel(r.n)} }`} from "${r.from}";\nimport { ${r.config} as K_${camel(r.n)} } from "${r.configFrom}";`,
  ),
  "globalThis.__snapcnPro = {",
  ...resolved.map(
    (r) => `  ${JSON.stringify(r.n)}: { Component: C_${camel(r.n)}, config: K_${camel(r.n)} },`,
  ),
  "};",
].join("\n");

const shared: Plugin = {
  name: "snapcn-shared",
  setup(b) {
    const filter = new RegExp(
      `^(${SHARED.map((s) => s.replace(/[/@.-]/g, "\\$&")).join("|")})$`,
    );
    b.onResolve({ filter }, (args) => ({ path: args.path, namespace: "shared" }));
    b.onLoad({ filter: /.*/, namespace: "shared" }, (args) => ({
      contents: `module.exports = globalThis.__snapcnShared[${JSON.stringify(args.path)}];`,
      loader: "js",
    }));
  },
};

/** `@/x` → `<root>/x`, as tsconfig paths. */
const alias: Plugin = {
  name: "snapcn-alias",
  setup(b) {
    b.onResolve({ filter: /^@\// }, async (args) => {
      if (SHARED.includes(args.path)) return undefined;
      return b.resolve(`./${args.path.slice(2)}`, {
        resolveDir: root,
        kind: args.kind,
      });
    });
  },
};

mkdirSync(outDir, { recursive: true });
const result = await build({
  stdin: { contents: entry, resolveDir: root, loader: "tsx" },
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "es2020",
  jsx: "automatic",
  minify: true,
  legalComments: "none",
  define: { "process.env.NODE_ENV": '"production"' },
  plugins: [shared, alias],
  outfile: path.join(outDir, "pro.js"),
  metafile: true,
  logLevel: "warning",
});

// The metadata the studio's AI and its prop validation need — no code. The
// configs are bundled for Node on their own and read from that, because the
// barrel is TSX that Node can't import.
const metaEntry = [
  ...resolved.map((r) => `import { ${r.config} as K_${camel(r.n)} } from "${r.configFrom}";`),
  "export default {",
  ...resolved.map((r) => `  ${JSON.stringify(r.n)}: K_${camel(r.n)},`),
  "};",
].join("\n");
const metaFile = path.join(outDir, ".configs.mjs");
await build({
  stdin: { contents: metaEntry, resolveDir: root, loader: "tsx" },
  bundle: true,
  format: "esm",
  platform: "node",
  jsx: "automatic",
  plugins: [alias],
  outfile: metaFile,
  logLevel: "warning",
});
const configs = (await import(metaFile)).default as Record<string, unknown>;
rmSync(metaFile);
const proRegistry = Object.fromEntries(
  Object.entries(configs).map(([k, config]) => [k, { config }]),
);
const byName = new Map(catalogue.map((c) => [c.name, c]));
const meta = names.map((n) => {
  const config = (proRegistry[n]?.config ?? null) as {
    controls?: unknown;
    durationInFrames?: number;
    fps?: number;
    previewBackdrop?: unknown;
  } | null;
  return {
    slug: n,
    name: byName.get(n)?.title ?? n,
    description: byName.get(n)?.description ?? "",
    controls: config?.controls ?? null,
    durationInFrames: config?.durationInFrames ?? null,
    fps: config?.fps ?? 30,
    previewBackdrop: config?.previewBackdrop ?? null,
  };
});
writeFileSync(path.join(outDir, "pro-meta.json"), JSON.stringify(meta));

const bytes = Object.values(result.metafile.outputs)[0]?.bytes ?? 0;
console.log(
  `studio pro: ${names.length} components, ${(bytes / 1024).toFixed(0)} KB → ${outDir}`,
);
if (skipped.length) console.log(`  not in the barrel, skipped: ${skipped.join(", ")}`);
