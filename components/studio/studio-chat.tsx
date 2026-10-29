"use client";

import {
  ArrowUp,
  Camera,
  ChevronDown,
  ChevronRight,
  Copy,
  Plus,
  RotateCcw,
  Sparkle,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { type Scene, STUDIO_MODELS, type StudioModel } from "@/lib/studio/ops";
import { cn } from "@/lib/utils";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  /** Scenes this turn added — the numbered list under the reply. */
  added?: Scene[];
  /** One line per edit, behind the "Edited the timeline" row. */
  log?: string[];
  /** Not sent back to the model as history. */
  error?: "signin" | "failed";
  /** A frame (or a region of one) pinned from the canvas camera. */
  snapshot?: Snapshot;
}

/**
 * What the canvas camera pins to the next prompt. The reference renders a
 * still and shows the model pixels; our model edits the timeline through
 * catalog tools and never sees the canvas, so the useful part is *where* —
 * scene, time and region — which rides on the prompt as text.
 */
export interface Snapshot {
  /** The chip: `Scene 2 · 00:03.10 · region`. */
  label: string;
  /** The line the model reads ahead of the user's note. */
  prompt: string;
}

const SUGGESTIONS = [
  "Make a 20-second launch film for Lumen, a calm notes app for designers",
  "A product walkthrough: sign up, create a project, share it with a team",
  "A short social teaser that ends on our logo",
];

export function StudioChat({
  title,
  titleEditable,
  onTitleChange,
  onTitleCommit,
  messages,
  pending,
  pendingLabel,
  onSend,
  onRetry,
  model,
  onModel,
  selectedLabel,
  onClearSelection,
  snapshotLabel,
  onClearSnapshot,
  onOpenLibrary,
}: {
  title: string;
  titleEditable: boolean;
  onTitleChange: (title: string) => void;
  onTitleCommit: () => void;
  messages: ChatMessage[];
  pending: boolean;
  pendingLabel: string;
  onSend: (text: string) => void;
  onRetry: () => void;
  model: StudioModel;
  onModel: (model: StudioModel) => void;
  selectedLabel: string | null;
  onClearSelection: () => void;
  snapshotLabel: string | null;
  onClearSnapshot: () => void;
  onOpenLibrary: () => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastAssistant = messages.findLast((m) => m.role === "assistant");

  // Follow the conversation as it grows, the way every chat does.
  // biome-ignore lint/correctness/useExhaustiveDependencies: scroll on new content
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages.length, pending]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-[#171717]">
      <div className="flex h-11 shrink-0 items-center px-4">
        {titleEditable ? (
          <input
            value={title}
            onChange={(e) => onTitleChange(e.target.value)}
            onBlur={onTitleCommit}
            onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            aria-label="Video title"
            className="w-full truncate rounded bg-transparent text-[13px] text-[#a0a0a0] outline-none focus:text-[#eeeeee]"
          />
        ) : (
          <span className="truncate text-[13px] text-[#a0a0a0]">{title}</span>
        )}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 overflow-y-auto px-4">
        {messages.length === 0 && !pending ? (
          <Welcome onPick={onSend} />
        ) : (
          <div className="flex min-h-full flex-col justify-end gap-5 py-4">
            {messages.map((m) =>
              m.role === "user" ? (
                <div
                  key={m.id}
                  className="ml-auto max-w-[85%] rounded-lg bg-[#262626] px-3 py-2 text-[14px] leading-5 whitespace-pre-wrap text-[#eeeeee]"
                >
                  {m.snapshot && (
                    <span className="mb-1 flex items-center gap-1 text-[12px] text-[#a0a0a0]">
                      <Camera className="size-3" />
                      {m.snapshot.label}
                    </span>
                  )}
                  {m.content}
                </div>
              ) : (
                <AssistantTurn
                  key={m.id}
                  message={m}
                  isLast={m === lastAssistant && !pending}
                  onRetry={onRetry}
                />
              ),
            )}
            {pending && <Thinking label={pendingLabel} />}
          </div>
        )}
      </div>

      <Composer
        pending={pending}
        onSend={onSend}
        model={model}
        onModel={onModel}
        selectedLabel={selectedLabel}
        onClearSelection={onClearSelection}
        snapshotLabel={snapshotLabel}
        onClearSnapshot={onClearSnapshot}
        onOpenLibrary={onOpenLibrary}
      />
    </div>
  );
}

function Welcome({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex min-h-full flex-col justify-center py-8">
      <Sparkle className="size-5 text-[#8a8a8a]" />
      <h2 className="mt-3 text-[20px] leading-7 text-[#eeeeee]">
        What are we making?
      </h2>
      <p className="mt-1 text-[13px] leading-5 text-[#a0a0a0]">
        Describe your product. The studio cuts a first version from snapcn
        scenes — then select any scene on the canvas and give notes.
      </p>
      <div className="mt-5 flex flex-col gap-1">
        {SUGGESTIONS.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => onPick(s)}
            className="rounded-md px-2.5 py-2 text-left text-[13px] leading-5 text-[#cfcfcf] transition-colors hover:bg-[#2a2a2a]"
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}

function AssistantTurn({
  message,
  isLast,
  onRetry,
}: {
  message: ChatMessage;
  isLast: boolean;
  onRetry: () => void;
}) {
  const [open, setOpen] = useState(false);
  const log = message.log ?? [];

  return (
    <div className="flex flex-col gap-3 text-[14px] leading-6 text-[#e6e6e6]">
      {message.content && (
        <p
          className={cn(
            "whitespace-pre-wrap",
            message.error && "text-[#eb858b]",
          )}
        >
          {message.content}
        </p>
      )}
      {message.error === "signin" && (
        <a
          href="/signin?callbackUrl=%2Fstudio"
          className="w-fit rounded-md bg-[#f2f2f2] px-3 py-1.5 text-[13px] font-medium text-[#111] hover:bg-white"
        >
          Sign in — it's free
        </a>
      )}
      {log.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="flex items-center gap-1 text-[13px] text-[#a0a0a0] hover:text-[#d0d0d0]"
          >
            {open ? (
              <ChevronDown className="size-3.5" />
            ) : (
              <ChevronRight className="size-3.5" />
            )}
            Edited the timeline · {log.length}{" "}
            {log.length === 1 ? "change" : "changes"}
          </button>
          {open && (
            <ul className="mt-1.5 ml-5 flex flex-col gap-0.5 text-[13px] text-[#8a8a8a]">
              {log.map((line, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static log
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {message.added && message.added.length > 0 && (
        <ol className="flex flex-col gap-2.5">
          {message.added.map((scene, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: a turn's scenes don't reorder
            <li key={i} className="flex gap-3">
              <span className="pt-px font-mono text-[12px] text-[#6b6b6b]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span className="flex flex-col">
                <span className="font-medium text-[#eeeeee]">
                  {scene.title}
                </span>
                {scene.note && (
                  <span className="text-[#a0a0a0]">{scene.note}</span>
                )}
              </span>
            </li>
          ))}
        </ol>
      )}
      {isLast && (
        <div className="flex gap-1 text-[#8a8a8a]">
          <IconButton
            label="Copy"
            onClick={() =>
              navigator.clipboard.writeText(message.content).catch(() => {})
            }
          >
            <Copy className="size-3.5" />
          </IconButton>
          <IconButton label="Retry" onClick={onRetry}>
            <RotateCcw className="size-3.5" />
          </IconButton>
        </div>
      )}
    </div>
  );
}

function Thinking({ label }: { label: string }) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSecs((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return (
    <p className="text-[14px] text-[#8a8a8a]">
      <span className="animate-pulse">{label}…</span>
      <span className="ml-2 tabular-nums">{secs}s</span>
    </p>
  );
}

function Composer({
  pending,
  onSend,
  model,
  onModel,
  selectedLabel,
  onClearSelection,
  snapshotLabel,
  onClearSnapshot,
  onOpenLibrary,
}: {
  pending: boolean;
  onSend: (text: string) => void;
  model: StudioModel;
  onModel: (model: StudioModel) => void;
  selectedLabel: string | null;
  onClearSelection: () => void;
  snapshotLabel: string | null;
  onClearSnapshot: () => void;
  onOpenLibrary: () => void;
}) {
  const [text, setText] = useState("");
  const canSend = text.trim().length > 0 && !pending;
  const submit = () => {
    if (!canSend) return;
    onSend(text.trim());
    setText("");
  };

  return (
    <div className="shrink-0 p-3 pt-1">
      <div className="rounded-lg bg-[#212121] px-3 pt-2.5 pb-2">
        {(selectedLabel || snapshotLabel) && (
          <div className="mb-2 flex flex-wrap gap-1">
            {snapshotLabel && (
              <Chip label="Remove snapshot" onClear={onClearSnapshot}>
                <Camera className="size-3" />
                {snapshotLabel}
              </Chip>
            )}
            {selectedLabel && (
              <Chip label="Clear selection" onClear={onClearSelection}>
                {selectedLabel}
              </Chip>
            )}
          </div>
        )}
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter breaks the line; never mid-IME.
            if (
              e.key === "Enter" &&
              !e.shiftKey &&
              !e.nativeEvent.isComposing
            ) {
              e.preventDefault();
              submit();
            }
          }}
          rows={3}
          placeholder={
            selectedLabel
              ? "Give notes on this scene…"
              : "Describe the scene you want to build…"
          }
          className="block w-full resize-none bg-transparent text-[14px] leading-5 text-[#eeeeee] outline-none placeholder:text-[#7a7a7a]"
        />
        <div className="mt-1.5 flex items-center gap-1">
          <IconButton label="Add a scene by hand" onClick={onOpenLibrary}>
            <Plus className="size-4" />
          </IconButton>
          <div className="ml-auto flex items-center gap-1">
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <button
                    type="button"
                    className="flex h-7 items-center gap-1 rounded-md px-2 text-[13px] text-[#cfcfcf] hover:bg-[#2a2a2a]"
                  />
                }
              >
                <Sparkle className="size-3.5" />
                {STUDIO_MODELS[model].label}
                <ChevronDown className="size-3.5 text-[#8a8a8a]" />
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                side="top"
                className="w-auto min-w-40 rounded-lg"
              >
                <DropdownMenuRadioGroup
                  value={model}
                  onValueChange={(v) => onModel(v as StudioModel)}
                >
                  {(Object.keys(STUDIO_MODELS) as StudioModel[]).map((key) => (
                    <DropdownMenuRadioItem key={key} value={key}>
                      {STUDIO_MODELS[key].label}
                    </DropdownMenuRadioItem>
                  ))}
                </DropdownMenuRadioGroup>
              </DropdownMenuContent>
            </DropdownMenu>
            <button
              type="button"
              aria-label="Send"
              disabled={!canSend}
              onClick={submit}
              className="grid size-7 place-items-center rounded-md bg-[#f2f2f2] text-[#111] transition-opacity disabled:bg-[#3a3a3a] disabled:text-[#8a8a8a]"
            >
              <ArrowUp className="size-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Chip({
  label,
  onClear,
  children,
}: {
  label: string;
  onClear: () => void;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded bg-[#2e2e2e] py-0.5 pr-1 pl-2 text-[12px] text-[#cfcfcf]">
      {children}
      <button
        type="button"
        aria-label={label}
        onClick={onClear}
        className="rounded p-0.5 hover:bg-[#3a3a3a]"
      >
        <X className="size-3" />
      </button>
    </span>
  );
}

function IconButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className="grid size-7 place-items-center rounded-md text-[#a0a0a0] transition-colors hover:bg-[#2a2a2a] hover:text-[#eeeeee]"
    >
      {children}
    </button>
  );
}
