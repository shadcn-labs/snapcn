import { generateText, stepCountIs, tool } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { checkRateLimit } from "@/lib/server/rate-limit";
import { CATALOG_PROMPT, lookup } from "@/lib/studio/catalog";
import {
  applyOp,
  DEFAULT_STUDIO_MODEL,
  planAdd,
  planMove,
  planRemove,
  planUpdate,
  type Scene,
  STUDIO_MODELS,
  type StudioOp,
  type StudioState,
} from "@/lib/studio/ops";
import { CANVAS, MAX_CLIPS, MAX_TOTAL_FRAMES } from "@/lib/video-editor/types";

/**
 * One studio turn: the user's prompt + the timeline as it stands → the edits
 * the AI made and its one-line reply.
 *
 * Not streamed. A turn is a handful of tool calls that each finish in
 * milliseconds; the wait is the model, and the client shows a timer for it.
 * Streaming would buy a typing effect on a two-sentence reply.
 *
 * Signed-in only: every request is a paid LLM call, and the account is what the
 * rate limit and any later quota hang off. Signing in is free.
 */

export const maxDuration = 120;

const MAX_HISTORY = 12;
const MAX_MESSAGE = 4000;

const messageSchema = z.object({
  role: z.enum(["user", "assistant"]),
  content: z.string().max(MAX_MESSAGE),
});

const bodySchema = z.object({
  messages: z.array(messageSchema).min(1).max(100),
  clips: z
    .array(
      z.object({
        id: z.string().max(64),
        slug: z.string().max(64),
        props: z.record(z.string(), z.unknown()),
        durationInFrames: z.number().int().min(1),
        background: z.string().max(16).optional(),
      }),
    )
    .max(MAX_CLIPS),
  scenes: z.record(
    z.string(),
    z.object({ title: z.string().max(200), note: z.string().max(400) }),
  ),
  selected: z.number().int().min(1).nullable(),
  model: z.enum(Object.keys(STUDIO_MODELS) as [keyof typeof STUDIO_MODELS]),
});

const INSTRUCTIONS = `You are the director inside snapcn Studio. You make short product videos by placing snapcn's ready-made animated scenes on a timeline and filling in their props. You never write code and never invent components: every scene is a component from the catalog below, used by its exact slug, with only the props it lists.

How to work:
- New video: plan 3–6 scenes that tell one story (hook → what it does → a feature or proof → call to action), then call add_scene once per scene, in order.
- Write real copy for the user's product in text props — short, concrete, no placeholders like "Your Product" or lorem ipsum. If you don't know what the product is called, ask in one sentence and build nothing.
- Pick the component whose description fits the beat. Scenes usually run 2–6 seconds; keep the video under 60 seconds unless asked. The canvas is ${CANVAS.width}×${CANVAS.height} at ${CANVAS.fps}fps; the whole timeline may not exceed ${MAX_TOTAL_FRAMES / CANVAS.fps} seconds.
- Edits: change only what was asked. "Scene N" is the 1-based position. When a scene is selected, "this", "it" and "here" mean that scene.
- Colours are hex. Image props take https URLs the user gave you; otherwise leave them alone.
- If a tool refuses, read why and fix the call.
- When you're done, reply in one or two plain sentences saying what you made or changed. No markdown, no headings, no lists — the studio shows the scene list itself.

Catalog (slug — name [category, natural length]: what it shows / props):
${CATALOG_PROMPT}`;

/** The timeline as the model reads it — long strings (data URLs) cut short. */
function describeTimeline(state: StudioState, selected: number | null): string {
  if (state.clips.length === 0) return "The timeline is empty.";
  const lines = state.clips.map((c, i) => {
    const props = Object.fromEntries(
      Object.entries(c.props).map(([k, v]) => [
        k,
        typeof v === "string" && v.length > 120 ? `${v.slice(0, 40)}…` : v,
      ]),
    );
    const scene = state.scenes[c.id];
    return `${i + 1}. ${c.slug}${scene ? ` "${scene.title}"` : ""} · ${(
      c.durationInFrames / CANVAS.fps
    ).toFixed(
      1,
    )}s · background ${c.background ?? "default"} · props ${JSON.stringify(props)}`;
  });
  return `Current timeline:\n${lines.join("\n")}\nSelected scene: ${selected ?? "none"}`;
}

export async function POST(request: Request) {
  const session = await auth().catch(() => null);
  const userId = session?.user?.id;
  if (!userId) {
    return NextResponse.json(
      { error: "Sign in to use the studio — it's free." },
      { status: 401 },
    );
  }
  if (!checkRateLimit(userId, "studio")) {
    return NextResponse.json(
      { error: "That's a lot of prompts in a minute — give it a moment." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  const body = parsed.data;

  // Clips the catalog doesn't know (a Pro or retired slug) stay on the user's
  // timeline; the model just isn't told about them, so it can't edit them.
  let state: StudioState = {
    clips: body.clips.filter((c) => lookup(c.slug)),
    scenes: body.scenes as Record<string, Scene>,
  };
  const ops: StudioOp[] = [];
  const record = (planned: { op: StudioOp } | { error: string }) => {
    if ("error" in planned) return planned.error;
    state = applyOp(state, planned.op);
    ops.push(planned.op);
    return `ok — the timeline now has ${state.clips.length} scenes`;
  };

  const tools = {
    add_scene: tool({
      description:
        "Add one scene to the timeline. Appends unless `position` (1-based) is given.",
      inputSchema: z.object({
        slug: z.string().describe("Catalog slug"),
        title: z.string().describe("2–5 word scene name, e.g. 'Opening'"),
        note: z.string().describe("One short line on what the scene does"),
        props: z
          .record(z.string(), z.unknown())
          .optional()
          .describe(
            "Only props this component lists; omitted ones keep defaults",
          ),
        seconds: z.number().optional(),
        background: z.string().optional().describe("Canvas hex colour"),
        position: z.number().int().optional(),
      }),
      execute: async (input) => record(planAdd(state, input, lookup)),
    }),
    update_scene: tool({
      description:
        "Change one scene's props, length, background, title or note. Props merge into what it has.",
      inputSchema: z.object({
        scene: z.number().int().describe("1-based position"),
        props: z.record(z.string(), z.unknown()).optional(),
        seconds: z.number().optional(),
        background: z.string().optional(),
        title: z.string().optional(),
        note: z.string().optional(),
      }),
      execute: async (input) => record(planUpdate(state, input, lookup)),
    }),
    remove_scene: tool({
      description: "Remove one scene.",
      inputSchema: z.object({ scene: z.number().int() }),
      execute: async (input) => record(planRemove(state, input)),
    }),
    move_scene: tool({
      description: "Move one scene to a new 1-based position.",
      inputSchema: z.object({ scene: z.number().int(), to: z.number().int() }),
      execute: async (input) => record(planMove(state, input)),
    }),
  };

  const history = body.messages.slice(-MAX_HISTORY);
  // Trimming can leave an assistant turn first, which the API refuses.
  while (history[0]?.role === "assistant") history.shift();
  if (history.at(-1)?.role !== "user") {
    return NextResponse.json({ error: "Malformed request." }, { status: 400 });
  }
  // The live timeline rides on the last user message rather than in the
  // instructions, so the instructions + catalog stay a stable, cacheable prefix.
  const last = history[history.length - 1];
  const messages = [
    ...history.slice(0, -1),
    {
      role: "user" as const,
      content: `${describeTimeline(state, body.selected)}\n\n${last.content}`,
    },
  ];

  try {
    const result = await generateText({
      model: STUDIO_MODELS[body.model ?? DEFAULT_STUDIO_MODEL].id,
      instructions: {
        role: "system",
        content: INSTRUCTIONS,
        providerOptions: {
          anthropic: { cacheControl: { type: "ephemeral" } },
        },
      },
      messages,
      tools,
      // Six scenes plus a fix or two, then the reply.
      stopWhen: stepCountIs(10),
    });
    return NextResponse.json({
      text: result.text.trim() || (ops.length ? "Done." : ""),
      ops,
    });
  } catch (err) {
    console.error("[studio] generation failed", err);
    const name = err instanceof Error ? err.name : "";
    const message = /auth|api.?key|credential/i.test(
      `${name} ${err instanceof Error ? err.message : ""}`,
    )
      ? "The studio's AI isn't configured on this server yet."
      : "The AI didn't answer. Try again in a moment.";
    // Ops already applied are still returned: a turn that built four of six
    // scenes before failing should not throw those four away.
    return NextResponse.json({ error: message, ops }, { status: 502 });
  }
}
