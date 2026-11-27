import { describe, expect, it } from "vitest";
import { lookup } from "@/lib/studio/catalog";
import { fixBrand, review } from "@/lib/studio/director";
import { applyOp, planAdd, type StudioState } from "@/lib/studio/ops";
import { extract, findUrl, isPrivateAddress } from "@/lib/studio/research";

describe("findUrl", () => {
  it("finds the site in a prompt", () => {
    expect(
      findUrl("https://www.paneloui.com/ - check this site")?.hostname,
    ).toBe("www.paneloui.com");
    expect(findUrl("video for paneloui.com.")?.href).toBe(
      "https://paneloui.com/",
    );
  });
  it("ignores file names and plain prose", () => {
    expect(findUrl("built with node.js and page.tsx")).toBeNull();
    expect(findUrl("a launch video for my habit app")).toBeNull();
  });
});

describe("isPrivateAddress — the research fetch's SSRF fence", () => {
  it.each([
    "127.0.0.1",
    "10.1.2.3",
    "172.20.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "0.0.0.0",
    "::1",
    "fd00::1",
    "fe80::1",
    "::ffff:10.0.0.1",
  ])("refuses %s", (ip) => expect(isPrivateAddress(ip)).toBe(true));
  it.each(["8.8.8.8", "76.76.21.21", "2606:4700::1111"])("allows %s", (ip) =>
    expect(isPrivateAddress(ip)).toBe(false),
  );
});

describe("extract", () => {
  const html = `<html><head><title>React Dashboard Components | Panelo UI</title>
    <meta property="og:site_name" content="Panelo UI"/>
    <meta name="description" content="40 components &amp; pages"/>
    <meta property="og:image" content="/og.png"/>
    <script>var x = "<h1>not a heading</h1>"</script></head>
    <body><h1>Dashboards AI agents can operate.</h1><button>Get started</button></body></html>`;
  it("reads the name as the site declares it, and the copy around it", () => {
    const site = extract(html, new URL("https://www.paneloui.com/"));
    expect(site.siteName).toBe("Panelo UI");
    expect(site.description).toBe("40 components & pages");
    expect(site.image).toBe("https://www.paneloui.com/og.png");
    expect(site.headings).toEqual(["Dashboards AI agents can operate."]);
    expect(site.actions).toContain("Get started");
  });
  it("falls back to the short end of the title", () => {
    const site = extract(
      "<title>React Dashboard Components | Panelo UI</title>",
      new URL("https://x.com/"),
    );
    expect(site.siteName).toBe("Panelo UI");
  });
});

describe("fixBrand", () => {
  it.each([
    ["Panel OUI ships them", "Panelo UI ships them"],
    ["Meet Paneloui", "Meet Panelo UI"],
    ["panelo-ui.", "Panelo UI."],
    ["Panelo UI", "Panelo UI"],
  ])("%s → %s", (input, out) => expect(fixBrand(input, "Panelo UI")).toBe(out));
  it("leaves other words alone", () => {
    expect(fixBrand("Paneloux and panels", "Panelo UI")).toBe(
      "Paneloux and panels",
    );
  });
});

const add = (state: StudioState, slug: string, props: object) => {
  const planned = planAdd(
    state,
    { slug, title: slug, note: "", props },
    lookup,
  );
  if ("error" in planned) throw new Error(planned.error);
  return applyOp(state, planned.op);
};

describe("text limits", () => {
  const empty: StudioState = { clips: [], scenes: {} };
  it("refuses a headline the component can't fit", () => {
    const planned = planAdd(
      empty,
      {
        slug: "text-reveal",
        title: "t",
        note: "",
        props: { text: "Stop rebuilding dashboards every quarter" },
      },
      lookup,
    );
    expect("error" in planned && planned.error).toMatch(/fits 28/);
  });
  it("checks list props per item", () => {
    const planned = planAdd(
      empty,
      {
        slug: "check-cycle",
        title: "t",
        note: "",
        props: { words: "Dashboards, An extremely long admin panel item" },
      },
      lookup,
    );
    expect("error" in planned && planned.error).toMatch(/each item fits 24/);
  });
});

describe("review", () => {
  const brief = { name: "Panelo UI" } as Parameters<typeof review>[2];
  it("fixes spelling itself and flags what only the director can fix", () => {
    let state: StudioState = { clips: [], scenes: {} };
    state = add(state, "text-reveal", { text: "Meet Panel OUI" });
    state = add(state, "text-reveal", { text: "Built for agents" });
    state = add(state, "wordmark-cut", { word: "snapcn." });
    const r = review(state, lookup, brief);
    expect(r.fixes).toEqual([{ scene: 1, props: { text: "Meet Panelo UI" } }]);
    expect(r.issues.join("\n")).toMatch(/Scene 2 reuses text-reveal/);
    expect(r.issues.join("\n")).toMatch(/Scene 3 .* snapcn's demo copy/);
  });
  it("lets a snapcn video be about snapcn", () => {
    const state = add({ clips: [], scenes: {} }, "wordmark-cut", {
      word: "snapcn.",
    });
    expect(review(state, lookup, null, true).issues).toEqual([]);
  });
  it("never offers a component that draws snapcn's mark", () => {
    expect(lookup("prompt-mark")).toBeUndefined();
    expect(lookup("announce-title")?.controls.symbolPath).toMatchObject({
      default: "",
    });
  });
});

describe("copy-driven length", () => {
  it("punch-lines natural length matches the component's own arithmetic", async () => {
    const { punchLinesDuration } = await import(
      "@/registry/snap-cn/punch-lines"
    );
    const { NATURAL_FRAMES } = await import("@/lib/studio/catalog");
    for (const [script, holds] of [
      ["a | b", "48"],
      ["a | b | c", "30,40"],
      ["a", ""],
      ["a | | b", "12, 20 ,x"],
    ]) {
      expect(NATURAL_FRAMES["punch-lines"]({ script, holds })).toBe(
        punchLinesDuration(script, holds),
      );
    }
  });
  it("the reviewer trims a two-card script to two cards", () => {
    const state = add({ clips: [], scenes: {} }, "punch-lines", {
      script: "Built for clicks | not for agents.",
      holds: "48",
    });
    expect(state.clips[0].durationInFrames).toBe(144);
    expect(review(state, lookup, null).fixes).toEqual([
      // The default accent card (3) doesn't exist in a two-card script either.
      { scene: 1, props: { accentBeat: 2 }, seconds: 96 / 30 },
    ]);
  });
  it("limits a sentence split across props as one line", () => {
    const planned = planAdd(
      { clips: [], scenes: {} },
      {
        slug: "text-highlight",
        title: "t",
        note: "",
        props: {
          before: "Built by Raycanvas. Backed by ",
          highlight: "Shadcn Labs",
          after: "",
        },
      },
      lookup,
    );
    expect("error" in planned && planned.error).toMatch(/together are 41/);
  });
});

describe("invisible settings", () => {
  it("makes a same-colour highlight visible and moves a missing accent card", () => {
    let state: StudioState = { clips: [], scenes: {} };
    state = add(state, "text-highlight", {
      before: "Every ",
      highlight: "agent",
      preset: "color",
      baseColor: "#ffffff",
      highlightedTextColor: "#FFFFFF",
      accentColor: "#7c3aed",
    });
    state = add(state, "punch-lines", { script: "a | b", accentBeat: 3 });
    const fixes = review(state, lookup, null).fixes;
    expect(fixes[0]).toMatchObject({
      scene: 1,
      props: { highlightedTextColor: "#7c3aed" },
    });
    expect(fixes[1]).toMatchObject({ scene: 2, props: { accentBeat: 2 } });
  });
});

describe("copy-driven lengths of the newly editable components", () => {
  it("title-sweep and drop-line match their own timing", async () => {
    const { NATURAL_FRAMES } = await import("@/lib/studio/catalog");
    const { timeline } = await import("@/registry/snap-cn/drop-line");
    for (const n of [1, 2, 4, 6]) {
      const words = Array.from({ length: n }, (_, i) => `w${i}`).join(", ");
      expect(NATURAL_FRAMES["drop-line"]({ words })).toBe(timeline(n).end);
    }
    // The shipped default: two titles, 76 frames.
    expect(NATURAL_FRAMES["title-sweep"]({ titles: "a | b" })).toBe(76);
  });
  it("flags demo copy left in a must-replace prop", () => {
    const state = add({ clips: [], scenes: {} }, "terminal-simulator", {});
    expect(review(state, lookup, null).issues.join("\n")).toMatch(
      /demo copy in `command`/,
    );
  });
  it("seeds count-grid with neutral cards, not snapcn posters", () => {
    expect(lookup("count-grid")?.controls.cards).toMatchObject({ default: "" });
  });
});
