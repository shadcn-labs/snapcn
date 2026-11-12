"use client";

import { Player, type PlayerRef } from "@remotion/player";
import {
  ArrowLeftRight,
  BadgeCheck,
  ChartColumnIncreasing,
  type LucideIcon,
  Megaphone,
  Smartphone,
  Type,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  AbsoluteFill,
  Html5Video,
  interpolate,
  Series,
  useCurrentFrame,
} from "remotion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MEDIA_BASE } from "@/lib/demo-urls";
import { cn } from "@/lib/utils";
import registry from "@/registry/__index__";

/**
 * A template shown as what it is: a timeline of beats, each beat a slot that
 * takes any of several components, all reading one set of words and colours.
 * It plays straight through; click a beat to jump to it, swap it for another
 * option, or type your own product into "Make it yours" and watch it change.
 *
 * The data mirrors `registry/snap-cn-pro/templates/template-01` by hand: that
 * tree is gitignored, so the public site cannot import it — and for the same
 * reason a Pro option cannot run here. Free options render live with the
 * visitor's words; a Pro option plays its clip, rendered with the template's
 * default words, from R2 `templates-wip/<beat>--<component>` (`v` is the mp4's
 * byte hash). Option order is the template's: the first is its default.
 */
type Content = {
  hookLine1: string;
  hookLine2: string;
  product: string;
  count: string;
  countNoun: string;
  accent: string;
};
type Option = {
  slug: string;
  label: string;
  frames: number;
  v: string;
  /** The template's bindings for a free option; absent means Pro (clip only). */
  props?: (
    c: Content & { background: string; ink: string },
  ) => Record<string, unknown>;
};
type Beat = {
  id: string;
  label: string;
  icon: LucideIcon;
  body: string;
  options: Option[];
};

const FPS = 30;
const PAPER = "#faf9f6";
const INK = "#141414";
/** Frames each beat dissolves in and out through the paper — the template's DISSOLVE_FRAMES. */
const DISSOLVE = 8;

const DEFAULTS: Content = {
  hookLine1: "Still hand-animating",
  hookLine2: "your launch video?",
  product: "snapcn",
  count: "500",
  countNoun: "components",
  accent: "#1d6bff",
};

const LAUNCH: Beat[] = [
  {
    id: "hook",
    label: "Hook",
    icon: Megaphone,
    body: "The viewer's pain, in your words.",
    options: [
      { slug: "pain-point", label: "Pain point", frames: 136, v: "b1bdd20444" },
      {
        slug: "text-reveal",
        label: "Text reveal",
        frames: 90,
        v: "377d2048c9",
        props: (c) => ({ color: c.ink, text: `${c.hookLine1} ${c.hookLine2}` }),
      },
      {
        slug: "word-flip",
        label: "Word flip",
        frames: 180,
        v: "d27f0b43d0",
        props: (c) => ({
          color: c.ink,
          prefix: c.hookLine1,
          words: [c.hookLine2],
          suffix: "",
        }),
      },
      {
        slug: "type-morph",
        label: "Type morph",
        frames: 150,
        v: "f7b4188033",
        props: (c) => ({
          background: c.background,
          ink: c.ink,
          lead: `${c.hookLine1} `,
          emphasis: c.hookLine2,
          morphTo: `try ${c.product}.`,
          finally_: `${c.product}.`,
        }),
      },
      {
        slug: "font-shuffle",
        label: "Font shuffle",
        frames: 115,
        v: "130a3fc319",
        props: (c) => ({
          mode: "light",
          lead: "Introducing",
          subject: c.product,
          accent: c.accent,
        }),
      },
    ],
  },
  {
    id: "product",
    label: "Product",
    icon: Smartphone,
    body: "What it is — your app, on screen.",
    options: [
      { slug: "app-reveal", label: "App reveal", frames: 106, v: "aa861f0280" },
      {
        slug: "phone-pitch",
        label: "Phone pitch",
        frames: 235,
        v: "e8de05353a",
      },
      {
        slug: "phone-frame",
        label: "Phone frame",
        frames: 240,
        v: "c66fb444aa",
        props: () => ({}),
      },
      {
        slug: "laptop-frame",
        label: "Laptop frame",
        frames: 240,
        v: "b90c0a13ba",
        props: () => ({}),
      },
    ],
  },
  {
    id: "proof",
    label: "Proof",
    icon: BadgeCheck,
    body: "Why anyone should believe it.",
    options: [
      { slug: "proof-line", label: "Proof line", frames: 47, v: "fa5cadbb26" },
      {
        slug: "punch-lines",
        label: "Punch lines",
        frames: 144,
        v: "b1e3192e25",
      },
    ],
  },
  {
    id: "numbers",
    label: "Numbers",
    icon: ChartColumnIncreasing,
    body: "The traction, counting up.",
    options: [
      {
        slug: "count-grid",
        label: "Count grid",
        frames: 47,
        v: "0b2b670771",
        props: (c) => ({ mode: "light", to: c.count, noun: c.countNoun }),
      },
      {
        slug: "metric-morph",
        label: "Metric morph",
        frames: 52,
        v: "b7030e60df",
      },
    ],
  },
  {
    id: "wordmark",
    label: "Wordmark",
    icon: Type,
    body: "Your name, landed last.",
    options: [
      {
        slug: "wordmark-cut",
        label: "Wordmark cut",
        frames: 66,
        v: "f76a27f48a",
        props: (c) => ({
          mode: "light",
          word: `${c.product}.`,
          dotFrom: c.accent,
        }),
      },
      {
        slug: "block-wordmark",
        label: "Block wordmark",
        frames: 150,
        v: "73adf5d50b",
        props: (c) => ({
          color: c.ink,
          background: c.background,
          text: c.product,
        }),
      },
      {
        slug: "logo-collapse",
        label: "Logo collapse",
        frames: 52,
        v: "efbe385cd0",
        props: (c) => ({
          mode: "light",
          wordmark: c.product,
          accent: c.accent,
        }),
      },
    ],
  },
];

const FIELDS: { key: keyof Content; label: string }[] = [
  { key: "product", label: "Product name" },
  { key: "hookLine1", label: "Hook, first line" },
  { key: "hookLine2", label: "Hook, second line" },
  { key: "count", label: "Headline number" },
  { key: "countNoun", label: "…of what" },
];

const clip = (b: Beat, o: Option) =>
  `${MEDIA_BASE}/templates-wip/${b.id}--${o.slug}.mp4?v=${o.v}`;

/** One beat on the paper, dissolving in and out through it — the template's `BeatFrame`. */
function Dissolve({
  frames,
  children,
}: {
  frames: number;
  children: React.ReactNode;
}) {
  const frame = useCurrentFrame();
  const t = Math.min(
    interpolate(frame, [0, DISSOLVE], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(frame, [frames - DISSOLVE, frames - 1], [1, 0], {
      extrapolateLeft: "clamp",
    }),
  );
  const out = frame > frames / 2;
  return (
    <AbsoluteFill
      style={{
        opacity: t,
        filter: t < 1 ? `blur(${(1 - t) * 8}px)` : undefined,
        transform:
          t < 1
            ? `scale(${out ? 1 - (1 - t) * 0.02 : 1 + (1 - t) * 0.02})`
            : undefined,
      }}
    >
      {children}
    </AbsoluteFill>
  );
}

type Shot = { beat: Beat; option: Option };

function TemplateVideo({
  shots,
  content,
}: {
  shots: Shot[];
  content: Content;
}) {
  const c = { ...content, background: PAPER, ink: INK };
  return (
    <AbsoluteFill style={{ backgroundColor: PAPER }}>
      <Series>
        {shots.map(({ beat, option }) => {
          const Component = option.props
            ? registry[option.slug]?.Component
            : null;
          return (
            <Series.Sequence key={beat.id} durationInFrames={option.frames}>
              {Component && option.props ? (
                <Dissolve frames={option.frames}>
                  <Component {...option.props(c)} />
                </Dissolve>
              ) : (
                // Pro: the clip already carries its dissolve.
                <Html5Video src={clip(beat, option)} muted />
              )}
            </Series.Sequence>
          );
        })}
      </Series>
    </AbsoluteFill>
  );
}

export function TemplateTimeline() {
  const [choice, setChoice] = useState<Record<string, number>>({});
  const [content, setContent] = useState<Content>(DEFAULTS);
  const [frame, setFrame] = useState(0);
  const player = useRef<PlayerRef>(null);

  const shots = LAUNCH.map((beat) => ({
    beat,
    option: beat.options[choice[beat.id] ?? 0],
  }));
  const starts: number[] = [];
  for (let i = 0, n = 0; i < shots.length; n += shots[i].option.frames, i++)
    starts.push(n);
  const total =
    starts[shots.length - 1] + shots[shots.length - 1].option.frames;
  let at = 0;
  for (let i = 0; i < starts.length; i++) if (frame >= starts[i]) at = i;
  const { beat, option } = shots[at];

  useEffect(() => {
    const p = player.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) =>
      setFrame(e.detail.frame);
    p.addEventListener("frameupdate", onFrame);
    return () => p.removeEventListener("frameupdate", onFrame);
  }, []);

  // Typing your words is pointless on a beat that cannot show them, so the
  // first edit moves every Pro beat that has a free option onto it.
  const edit = (patch: Partial<Content>) => {
    setContent((c) => ({ ...c, ...patch }));
    setChoice((c) => {
      const next = { ...c };
      for (const b of LAUNCH) {
        if (b.options[c[b.id] ?? 0].props) continue;
        const free = b.options.findIndex((o) => o.props);
        if (free >= 0) next[b.id] = free;
      }
      return next;
    });
  };

  const jump = (i: number) => {
    player.current?.seekTo(starts[i]);
    player.current?.play();
  };
  const ticks = Array.from(
    { length: Math.floor(total / FPS / 2) + 1 },
    (_, i) => i * 2,
  );
  const live = shots.filter((s) => s.option.props).length;

  return (
    <div>
      <div className="relative aspect-video w-full overflow-hidden rounded-2xl border border-border bg-gallery-card">
        <Player
          ref={player}
          component={TemplateVideo}
          inputProps={{ shots, content }}
          durationInFrames={total}
          fps={FPS}
          compositionWidth={1280}
          compositionHeight={720}
          style={{ width: "100%", height: "100%" }}
          autoPlay
          loop
          initiallyMuted
          acknowledgeRemotionLicense
        />
        <span className="pointer-events-none absolute top-3 left-3 rounded-full bg-background/80 px-2.5 py-1 font-mono text-[0.6875rem] text-foreground backdrop-blur">
          {beat.label} · {option.label}
          {option.props ? "" : " · Pro preview"}
        </span>
      </div>

      {/* Ruler */}
      <div className="relative mt-6 h-6 border-border border-b">
        {ticks.map((t) => (
          <span
            key={t}
            className="absolute bottom-0 h-2 border-border border-l"
            style={{ left: `${((t * FPS) / total) * 100}%` }}
          >
            <span className="-top-4 absolute left-0 font-mono text-[0.625rem] text-muted-foreground">
              0:{String(t).padStart(2, "0")}
            </span>
          </span>
        ))}
      </div>

      {/* Beats */}
      <div className="relative mt-2 flex gap-1.5">
        {shots.map(({ beat: b, option: o }, i) => {
          const Icon = b.icon;
          return (
            <button
              key={b.id}
              type="button"
              onClick={() => jump(i)}
              aria-pressed={i === at}
              style={{ flexGrow: o.frames, flexBasis: 0 }}
              className={cn(
                "flex min-w-0 flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-3 text-sm transition-colors",
                i === at
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              <span className="flex max-w-full items-center gap-1.5">
                <Icon aria-hidden className="size-4 shrink-0" />
                <span className="truncate">{b.label}</span>
              </span>
              <span className="max-w-full truncate font-mono text-[0.625rem] opacity-70">
                {(o.frames / FPS).toFixed(1)}s
              </span>
            </button>
          );
        })}
        <span
          aria-hidden
          className="-inset-y-2 pointer-events-none absolute w-0.5 rounded bg-foreground"
          style={{ left: `${(frame / total) * 100}%` }}
        />
      </div>

      {/* The swap */}
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm">
          <span className="font-medium text-foreground">{beat.label}</span>
          <span className="text-muted-foreground"> — {beat.body}</span>
        </p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 flex items-center gap-1 text-muted-foreground text-xs">
            <ArrowLeftRight aria-hidden className="size-3.5" /> Swap
          </span>
          {beat.options.map((o, i) => (
            <button
              key={o.slug}
              type="button"
              onClick={() => {
                setChoice((c) => ({ ...c, [beat.id]: i }));
                player.current?.seekTo(starts[at]);
              }}
              aria-pressed={(choice[beat.id] ?? 0) === i}
              className={cn(
                "rounded-full border px-3 py-1 text-xs transition-colors",
                (choice[beat.id] ?? 0) === i
                  ? "border-foreground bg-foreground text-background"
                  : "border-border text-muted-foreground hover:text-foreground",
              )}
            >
              {o.label}
              {o.props ? "" : " · Pro"}
            </button>
          ))}
        </div>
      </div>

      {/* Make it yours */}
      <div className="mt-8 rounded-2xl border border-border p-5">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
          <h3 className="font-medium text-foreground">Make it yours</h3>
          <p className="text-muted-foreground text-xs">
            {live} of {shots.length} beats update live here. Pro beats preview
            with sample words — installed, they read yours too.
          </p>
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          {FIELDS.map((f) => (
            <div key={f.key} className="grid gap-1.5">
              <Label htmlFor={`tpl-${f.key}`}>{f.label}</Label>
              <Input
                id={`tpl-${f.key}`}
                value={content[f.key]}
                maxLength={40}
                onChange={(e) => edit({ [f.key]: e.target.value })}
              />
            </div>
          ))}
          <div className="grid gap-1.5">
            <Label htmlFor="tpl-accent">Accent</Label>
            <Input
              id="tpl-accent"
              type="color"
              value={content.accent}
              onChange={(e) => edit({ accent: e.target.value })}
              className="h-9 p-1"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
