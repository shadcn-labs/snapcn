import { beforeEach, describe, expect, it, vi } from "vitest";

// The gate for the studio's Pro script. Every test here is one way the paid
// catalogue could leak if it regressed.

vi.mock("server-only", () => ({}));
vi.stubEnv("AUTH_SECRET", "test-secret-for-studio-pro");

const session = { current: null as { user: { id: string } } | null };
const plans = { current: false };
vi.mock("@/auth", () => ({ auth: async () => session.current }));
vi.mock("@/lib/server/entitlements", async (orig) => ({
  ...(await orig<object>()),
  planFor: async () => ({ limits: { components: plans.current } }),
}));
vi.mock("@/lib/server/pro-registry", async (orig) => ({
  ...(await orig<object>()),
  readStudioPro: async (file: string) =>
    file === "pro.js" ? "/* pro */" : "[]",
}));

const { mintStudioProToken, verifyStudioProToken, STUDIO_PRO_TOKEN_TTL_MS } =
  await import("@/lib/server/studio-pro-token");
const { GET } = await import("@/app/api/studio/pro/[file]/route");
const { buildSpec } = await import("@/app/api/render/route");
const { PLANS, ANONYMOUS } = await import("@/lib/plans");
const { PRO_NAMES } = await import("@/config/catalogue");

const get = (file: string, query = "") =>
  GET(new Request(`https://snapcn.dev/api/studio/pro/${file}${query}`), {
    params: Promise.resolve({ file }),
  });

beforeEach(() => {
  session.current = null;
  plans.current = false;
});

describe("studio pro token", () => {
  it("verifies its own token, until it expires", () => {
    const now = Date.now();
    const t = mintStudioProToken(now) as string;
    expect(verifyStudioProToken(t, now)).toBe(true);
    expect(verifyStudioProToken(t, now + STUDIO_PRO_TOKEN_TTL_MS + 1)).toBe(
      false,
    );
  });

  it("rejects a tampered, extended or malformed token", () => {
    const t = mintStudioProToken() as string;
    const [exp, sig] = t.split(".");
    expect(verifyStudioProToken(`${Number(exp) + 1e9}.${sig}`)).toBe(false);
    expect(verifyStudioProToken(`${exp}.${sig.slice(0, -1)}x`)).toBe(false);
    expect(verifyStudioProToken(`${exp}`)).toBe(false);
    expect(verifyStudioProToken("")).toBe(false);
    expect(verifyStudioProToken(null)).toBe(false);
  });
});

describe("GET /api/studio/pro/[file]", () => {
  it("is 404 to a stranger, a free account, and a bad token", async () => {
    expect((await get("pro.js")).status).toBe(404);
    session.current = { user: { id: "u1" } };
    expect((await get("pro.js")).status).toBe(404);
    expect((await get("pro.js", "?t=123.abc")).status).toBe(404);
  });

  it("serves a plan that unlocks components, privately", async () => {
    session.current = { user: { id: "u1" } };
    plans.current = true;
    const res = await get("pro.js");
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("private, no-store");
    expect(await res.text()).toBe("/* pro */");
  });

  it("serves our renderer's signed token without a session", async () => {
    const t = mintStudioProToken() as string;
    expect((await get("pro.js", `?t=${encodeURIComponent(t)}`)).status).toBe(
      200,
    );
  });

  it("serves only its two files, whoever asks", async () => {
    session.current = { user: { id: "u1" } };
    plans.current = true;
    for (const f of ["../agent-chat.json", "agent-chat.json", "pro.js.map"]) {
      expect((await get(f)).status).toBe(404);
    }
  });
});

describe("buildSpec with Pro scenes", () => {
  const pro = PRO_NAMES[0];
  const clips = [
    { slug: "text-reveal", durationInFrames: 30, props: {} },
    { slug: pro, durationInFrames: 30, props: {} },
  ];
  const origin = "https://snapcn.dev";

  it("refuses a plan without components, whatever the body claims", () => {
    for (const limits of [ANONYMOUS, PLANS.free, PLANS.starter]) {
      expect(() =>
        buildSpec(
          { clips, pro: true, limits: { components: true } },
          { limits, origin, proToken: "x" },
        ),
      ).toThrow(/Pro scenes/);
    }
  });

  it("points a Pro export at our own signed script URL", () => {
    const spec = buildSpec(
      { clips, proBundle: "https://evil.example/x.js" },
      { limits: PLANS.pro, origin, proToken: "123.sig" },
    );
    expect(spec.inputProps.proBundle).toBe(
      `${origin}/api/studio/pro/pro.js?t=123.sig`,
    );
  });

  it("gives a free-only video no script URL at all", () => {
    const spec = buildSpec(
      { clips: [clips[0]], proBundle: "https://evil.example/x.js" },
      { limits: PLANS.pro, origin, proToken: "123.sig" },
    );
    expect(spec.inputProps).not.toHaveProperty("proBundle");
  });

  it("fails a Pro export on a server with no secret to sign with", () => {
    expect(() =>
      buildSpec({ clips }, { limits: PLANS.pro, origin, proToken: null }),
    ).toThrow(/can't be exported/);
  });
});

describe("proCatalog", () => {
  it("adds Pro scenes to the lookup and the prompt, keeping free ones", async () => {
    vi.resetModules();
    vi.doMock("server-only", () => ({}));
    vi.doMock("@/lib/server/pro-registry", () => ({
      readStudioPro: async () =>
        JSON.stringify([
          {
            slug: "clear-view",
            name: "Clear View",
            description: "A headline over a pixel field",
            controls: {
              headline: { type: "text", default: "Hi", label: "Headline" },
            },
            durationInFrames: 168,
            fps: 30,
            previewBackdrop: { type: "color", value: "#0a0a0a" },
          },
        ]),
    }));
    const { proCatalog } = await import("@/lib/studio/pro-catalog");
    const cat = await proCatalog();
    expect(cat.lookup("clear-view")?.durationInFrames).toBe(168);
    expect(cat.lookup("text-reveal")).toBeDefined();
    expect(cat.prompt).toMatch(/- clear-view — Clear View \[pro, 5\.6s\]/);
    expect(cat.prompt).toMatch(/headline \(text/);
  });
});
