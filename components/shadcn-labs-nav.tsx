"use client";

import { ArrowUpRight, ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { SnapCnLogo } from "@/components/snapcn-logo";
import { LABS_PROJECTS, type LabsLink, SHADCN_LABS_URL } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * "[Labs mark] / snapcn ▾" — the header every Shadcn Labs project wears
 * (termcn, framecn, emailcn …), lifted from termcn's `labs-nav.tsx`: the mark
 * goes to shadcn-labs.com, the name opens a full-width panel of the sibling
 * projects. Our mark stays as the home link between the two.
 *
 * Hand-rolled rather than a NavigationMenu (we have none): one open flag, a
 * backdrop that closes it, Escape. The panel is portalled to <body> because the
 * sticky header's `backdrop-blur` makes it the containing block for `fixed`,
 * which would pin the panel inside the 56px bar. It opens under the trigger's
 * own bottom edge, so the same component works in the header and the docs rail.
 */
const utm = (href: string) => `${href}?utm_source=snapcn.dev`;

export function LabsLogo() {
  return (
    <svg
      viewBox="0 0 505 455"
      fill="currentColor"
      // 24px tall: the visible height of the snapcn mark beside it (its 28px
      // image carries ~14% transparent margin), so the two read as one size.
      className="h-6 w-auto"
      aria-hidden="true"
    >
      <path d="M155 45c0 5.523-4.477 10-10 10h-30c-5.523 0-10 4.477-10 10v30c0 5.523-4.477 10-10 10H65c-5.523 0-10 4.477-10 10v225c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v30c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v35c0 5.523-4.477 10-10 10h-35c-5.523 0-10-4.477-10-10v-30c0-5.523-4.477-10-10-10H60c-5.523 0-10-4.477-10-10v-30c0-5.523-4.477-10-10-10H10c-5.523 0-10-4.477-10-10V110c0-5.523 4.477-10 10-10h30c5.523 0 10-4.477 10-10V60c0-5.523 4.477-10 10-10h30c5.523 0 10-4.477 10-10V10c0-5.523 4.477-10 10-10h35c5.523 0 10 4.477 10 10zm250-5c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v30c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v235c0 5.523-4.477 10-10 10h-30c-5.523 0-10 4.477-10 10v30c0 5.523-4.477 10-10 10h-30c-5.523 0-10 4.477-10 10v30c0 5.523-4.477 10-10 10h-35c-5.523 0-10-4.477-10-10v-35c0-5.523 4.477-10 10-10h30c5.523 0 10-4.477 10-10v-30c0-5.523 4.477-10 10-10h30c5.523 0 10-4.477 10-10V115c0-5.523-4.477-10-10-10h-30c-5.523 0-10-4.477-10-10V65c0-5.523-4.477-10-10-10h-30c-5.523 0-10-4.477-10-10V10c0-5.523 4.477-10 10-10h35c5.523 0 10 4.477 10 10z" />
      <path d="M305 90c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v35c0 5.523-4.477 10-10 10h-35c-5.523 0-10-4.477-10-10v-30c0-5.523-4.477-10-10-10h-75c-5.523 0-10 4.477-10 10v75c0 5.523 4.477 10 10 10h80c5.523 0 10 4.477 10 10v30c0 5.523 4.477 10 10 10h30c5.523 0 10 4.477 10 10v85c0 5.523-4.477 10-10 10h-30c-5.523 0-10 4.477-10 10v30c0 5.523-4.477 10-10 10h-85c-5.523 0-10-4.477-10-10v-30c0-5.523-4.477-10-10-10h-30c-5.523 0-10-4.477-10-10v-35c0-5.523 4.477-10 10-10h35c5.523 0 10 4.477 10 10v30c0 5.523 4.477 10 10 10h75c5.523 0 10-4.477 10-10v-75c0-5.523-4.477-10-10-10h-80c-5.523 0-10-4.477-10-10v-30c0-5.523-4.477-10-10-10h-30c-5.523 0-10-4.477-10-10v-85c0-5.523 4.477-10 10-10h30c5.523 0 10-4.477 10-10V60c0-5.523 4.477-10 10-10h85c5.523 0 10 4.477 10 10z" />
    </svg>
  );
}

const TITLE = "text-sm font-medium text-muted-foreground";

/** A sister project: its name, what it is for, and where it goes. */
function ProjectLink({ item }: { item: LabsLink }) {
  return (
    <a
      href={utm(item.href)}
      target="_blank"
      rel="noopener noreferrer"
      title={item.description}
      className="group flex flex-col rounded-[8px] px-3 py-1.5 transition-colors hover:bg-foreground/5"
    >
      <span className="inline-flex items-center gap-1 font-medium text-foreground text-sm">
        {item.name}
        <ArrowUpRight
          className="size-3.5 shrink-0 opacity-0 transition-opacity group-hover:opacity-60"
          aria-hidden="true"
        />
      </span>
      {item.description ? (
        <span className="truncate text-muted-foreground text-xs">
          {item.description}
        </span>
      ) : null}
    </a>
  );
}

/** The sheet's grow/shrink: a soft spring, no bounce. */
const SHEET = { type: "spring" as const, stiffness: 320, damping: 34 };

/**
 * The navbar growing down into a sheet. One frosted layer starts at the
 * header's own top edge and animates its height from the header's to the
 * header's plus the links', so the menu reads as the bar opening rather than a
 * panel dropped under it. The header goes transparent meanwhile
 * (`html[data-menu-open]`, sticky-header-shell.tsx) — two frosts would seam.
 */
function Panel({
  top,
  header,
  onClose,
  onHold,
}: {
  top: number;
  header: number;
  onClose: () => void;
  onHold: (held: boolean) => void;
}) {
  useEffect(() => {
    document.documentElement.setAttribute("data-menu-open", "");
    return () => document.documentElement.removeAttribute("data-menu-open");
  }, []);

  return (
    <>
      <motion.button
        type="button"
        aria-label="Close menu"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-x-0 bottom-0 z-[38] cursor-default bg-background/40 backdrop-blur-[2px]"
        style={{ top }}
        onClick={onClose}
      />
      <motion.nav
        aria-label="Shadcn Labs projects"
        initial={{ height: header }}
        animate={{ height: "auto" }}
        exit={{ height: header }}
        transition={SHEET}
        className="fixed inset-x-0 z-[39] max-h-[calc(100dvh-4rem)] overflow-hidden border-border border-b bg-background/80 backdrop-blur-xl"
        style={{ top }}
        onMouseEnter={() => onHold(true)}
        onMouseLeave={() => onHold(false)}
      >
        {/* Room for the header, which sits on top of this layer. */}
        <div style={{ height: header }} />
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18 }}
          className="section flex flex-col gap-3 pt-1 pb-5"
        >
          {/* One line of who makes these, then every project in a compact grid:
              name, and what it is for on one truncated line. */}
          <div className="flex items-center justify-between gap-4 px-3">
            <p className={TITLE}>More from Shadcn Labs</p>
            <a
              href={utm(SHADCN_LABS_URL)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 font-medium text-foreground text-sm underline-offset-4 hover:underline"
            >
              Visit Shadcn Labs
              <ArrowUpRight className="size-3.5" aria-hidden="true" />
            </a>
          </div>
          <ul className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5">
            {LABS_PROJECTS.map((item) => (
              <li key={item.href} className="min-w-0">
                <ProjectLink item={item} />
              </li>
            ))}
          </ul>
        </motion.div>
      </motion.nav>
    </>
  );
}

export function ShadcnLabsNav({ className }: { className?: string }) {
  const [sheet, setSheet] = useState<{ top: number; header: number } | null>(
    null,
  );
  const top = sheet?.top ?? null;
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const trigger = useRef<HTMLButtonElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const close = () => setSheet(null);
  // The sheet starts at the header's top edge and is first exactly its height.
  const open = () => {
    const box = trigger.current?.closest("header")?.getBoundingClientRect();
    setSheet({ top: box?.top ?? 0, header: box?.height ?? 56 });
  };
  // Opens on hover like termcn's NavigationMenu. Leaving starts a short close
  // so the pointer can move from the trigger into the sheet; entering cancels.
  const hold = (held: boolean) => {
    clearTimeout(timer.current);
    if (!held) timer.current = setTimeout(close, 150);
  };

  useEffect(() => {
    if (top === null) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setSheet(null);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [top]);

  return (
    <span className={cn("flex items-center gap-2", className)}>
      <span className="relative flex items-center text-foreground">
        <Link href="/" aria-label="snapcn home" tabIndex={-1}>
          <LabsLogo />
        </Link>
        <a
          href={SHADCN_LABS_URL}
          target="_blank"
          rel="noopener noreferrer"
          title="Shadcn Labs"
          className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2"
        >
          <span className="sr-only">Go to Shadcn Labs</span>
        </a>
      </span>
      <span className="select-none text-muted-foreground/60" aria-hidden="true">
        /
      </span>
      <Link href="/" aria-label="snapcn home" className="flex items-center">
        <SnapCnLogo />
      </Link>
      {/* The word goes home, like the logo beside it; the chevron opens the
          Labs menu. Hover over either still opens it. */}
      <span className="flex items-center">
        <Link
          href="/"
          className="rounded-md px-1 py-1 font-medium text-base"
          onMouseEnter={() => {
            hold(true);
            open();
          }}
          onMouseLeave={() => hold(false)}
        >
          snapcn
        </Link>
        <button
          ref={trigger}
          type="button"
          aria-expanded={top !== null}
          aria-label="Shadcn Labs projects"
          onMouseEnter={() => {
            hold(true);
            open();
          }}
          onMouseLeave={() => hold(false)}
          className="flex items-center rounded-md px-0.5 py-1"
          // Touch and keyboard have no hover: a click opens, backdrop/Escape close.
          onClick={open}
        >
          <ChevronDown
            className={cn(
              "size-3 transition-transform duration-200",
              top !== null && "rotate-180",
            )}
            strokeWidth={2.5}
            aria-hidden="true"
          />
        </button>
      </span>
      {mounted
        ? createPortal(
            <AnimatePresence>
              {sheet ? (
                <Panel
                  top={sheet.top}
                  header={sheet.header}
                  onClose={close}
                  onHold={hold}
                />
              ) : null}
            </AnimatePresence>,
            document.body,
          )
        : null}
    </span>
  );
}
