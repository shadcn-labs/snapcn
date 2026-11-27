"use client";

import { Check, Moon, Pause, Play, Sun } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  levelledVolume,
  musicSrc,
  TRACKS,
  type Track,
} from "@/lib/studio/music";
import type { Mode } from "@/lib/studio/scene-data";
import { cn } from "@/lib/utils";

/**
 * The studio's soundtrack and look.
 *
 * Music is the user's pick, by ear: the studio lists the library, previews each
 * track from where it arrives in full (its measured drop), and — once one is
 * chosen — cuts the whole video to it (`beat-sync.ts`). It never chooses a
 * track on analysis.
 *
 * The look is one switch for the whole video: light or dark, applied to every
 * scene with the keys measured for that component.
 */

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export function MusicPanel({
  selected,
  videoSeconds,
  onPick,
  mode,
  onMode,
}: {
  selected: string | null;
  videoSeconds: number;
  onPick: (track: Track | null) => void;
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  useEffect(() => () => audioRef.current?.pause(), []);

  const preview = (track: Track) => {
    if (!audioRef.current) audioRef.current = new Audio();
    const el = audioRef.current;
    if (playing === track.slug) {
      el.pause();
      setPlaying(null);
      return;
    }
    el.src = musicSrc(track.slug);
    el.volume = levelledVolume(track);
    // From the drop: the first second of most beds is the least like the rest.
    const bar = track.beat * track.beatsPerBar;
    el.currentTime = Math.max(
      0,
      track.firstDownbeat + track.dropBar * bar - bar,
    );
    void el.play();
    el.onended = () => setPlaying(null);
    setPlaying(track.slug);
  };

  return (
    <div className="flex flex-col gap-5 px-3 pb-4">
      <section className="flex flex-col gap-2">
        <h3 className="text-[11px] font-medium uppercase tracking-wide text-[#8a8a8a]">
          Look
        </h3>
        <div className="grid grid-cols-2 gap-1 rounded-[10px] bg-[#111] p-1">
          {(["light", "dark"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onMode(m)}
              className={cn(
                "flex h-8 items-center justify-center gap-1.5 rounded-[8px] text-[13px] text-[#a1a1a1] transition-colors",
                mode === m && "bg-[#262626] text-[#eeeeee]",
              )}
            >
              {m === "light" ? (
                <Sun className="size-3.5" />
              ) : (
                <Moon className="size-3.5" />
              )}
              {m === "light" ? "Light" : "Dark"}
            </button>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <h3 className="text-[11px] font-medium uppercase tracking-wide text-[#8a8a8a]">
            Music
          </h3>
          {selected && (
            <button
              type="button"
              onClick={() => onPick(null)}
              className="text-[12px] text-[#8a8a8a] hover:text-[#eeeeee]"
            >
              No music
            </button>
          )}
        </div>
        <p className="text-[12px] leading-relaxed text-[#8a8a8a]">
          Pick a track and every cut moves onto its beat.
        </p>
        <ul className="flex flex-col gap-1">
          {TRACKS.map((track) => {
            const active = selected === track.slug;
            const short =
              track.durationSeconds - track.firstDownbeat < videoSeconds;
            return (
              <li
                key={track.slug}
                className={cn(
                  "flex items-center gap-2 rounded-[10px] border border-transparent px-2 py-1.5",
                  active ? "border-[#333] bg-[#1f1f1f]" : "hover:bg-[#1a1a1a]",
                )}
              >
                <button
                  type="button"
                  aria-label={
                    playing === track.slug
                      ? `Stop ${track.title}`
                      : `Preview ${track.title}`
                  }
                  onClick={() => preview(track)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#262626] text-[#eeeeee] hover:bg-[#333]"
                >
                  {playing === track.slug ? (
                    <Pause className="size-3.5" />
                  ) : (
                    <Play className="size-3.5" />
                  )}
                </button>
                <button
                  type="button"
                  disabled={short}
                  onClick={() => onPick(track)}
                  className="flex min-w-0 flex-1 flex-col items-start text-left disabled:opacity-40"
                >
                  <span className="w-full truncate text-[13px] text-[#eeeeee]">
                    {track.title}
                  </span>
                  <span className="text-[11px] text-[#8a8a8a] tabular-nums">
                    {track.artist} · {Math.round(track.bpm)} BPM ·{" "}
                    {fmt(track.durationSeconds)}
                    {short ? " · shorter than the video" : ""}
                  </span>
                </button>
                {active && <Check className="size-4 shrink-0 text-[#eeeeee]" />}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
