"use client";

import {
  Copy,
  LayoutGrid,
  MessageSquare,
  MoreHorizontal,
  PanelLeftClose,
  Pencil,
  Search,
  SquarePen,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { UserMenu } from "@/components/auth/user-menu";
import { SnapCnLogo } from "@/components/snapcn-logo";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { X_URL } from "@/config/site";
import { cn } from "@/lib/utils";
import type { ProjectSummary } from "@/lib/video-editor/project";
import type { UseProjects } from "../video-editor/use-projects";

/**
 * The studio's left rail: your videos, and the way out to the rest of snapcn.
 *
 * Built the way people already read a chat sidebar (Linear, ChatGPT, Claude):
 * one quiet "New video" at the top, the list grouped by when — not a timestamp
 * on every row — and each row's actions behind a ⋯ that appears on hover or
 * when the row is open, so twenty videos read as a list and not a toolbar.
 * Rename is inline (menu or double-click); Duplicate leaves the copy closed;
 * Delete asks first, because it is permanent and a deleted video that was open
 * can't be put back from a toast.
 *
 * Navigation the studio doesn't own (components, the timeline editor) moves
 * to the footer: it was sitting above the user's own work.
 */

const SEARCH_FROM = 7;

const GROUPS: { label: string; maxDays: number }[] = [
  { label: "Today", maxDays: 0 },
  { label: "Yesterday", maxDays: 1 },
  { label: "Previous 7 days", maxDays: 7 },
  { label: "Previous 30 days", maxDays: 30 },
  { label: "Older", maxDays: Number.POSITIVE_INFINITY },
];

function dayDiff(iso: string, now: Date): number {
  const d = new Date(iso);
  const a = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const b = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((a.getTime() - b.getTime()) / 86_400_000);
}

function groupByDay(items: ProjectSummary[]) {
  const now = new Date();
  const groups = GROUPS.map((g) => ({ ...g, items: [] as ProjectSummary[] }));
  for (const p of items) {
    const days = dayDiff(p.updatedAt, now);
    const g =
      groups.find((x) => days <= x.maxDays) ?? groups[groups.length - 1];
    g.items.push(p);
  }
  return groups.filter((g) => g.items.length > 0);
}

export function VideoSidebar({
  projects,
  signedIn,
  onHide,
}: {
  projects: UseProjects;
  signedIn: boolean;
  onHide: () => void;
}) {
  const [query, setQuery] = useState("");
  const [deleting, setDeleting] = useState<ProjectSummary | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q
      ? projects.projects.filter((p) => p.title.toLowerCase().includes(q))
      : projects.projects;
  }, [projects.projects, query]);
  const groups = useMemo(() => groupByDay(filtered), [filtered]);

  return (
    <aside className="hidden w-[260px] shrink-0 flex-col pt-3 pb-2 lg:flex">
      <div className="flex h-8 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <SnapCnLogo className="h-5" />
          <span className="text-[14px] font-medium text-[#eeeeee]">Studio</span>
        </Link>
        <button
          type="button"
          aria-label="Hide sidebar"
          onClick={onHide}
          className="grid size-7 place-items-center rounded-[8px] text-[#8a8a8a] transition-colors hover:bg-[#222] hover:text-[#eeeeee]"
        >
          <PanelLeftClose className="size-4" />
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-1 px-2">
        <button
          type="button"
          onClick={() => void projects.newProject()}
          className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] font-medium text-[#eeeeee] transition-colors hover:bg-[#1f1f1f]"
        >
          <SquarePen className="size-4 text-[#a0a0a0]" />
          New video
        </button>
        {projects.enabled && projects.projects.length >= SEARCH_FROM && (
          <label className="flex h-9 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] text-[#8a8a8a] focus-within:bg-[#1a1a1a] hover:bg-[#1a1a1a]">
            <Search className="size-4 shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === "Escape" && setQuery("")}
              placeholder="Search videos"
              aria-label="Search videos"
              className="min-w-0 flex-1 bg-transparent text-[#eeeeee] outline-none placeholder:text-[#6b6b6b]"
            />
          </label>
        )}
      </div>

      <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-2 [scrollbar-width:thin]">
        {!projects.enabled ? (
          <SignedOutList title={projects.title} signedIn={signedIn} />
        ) : groups.length === 0 ? (
          <p className="px-2.5 py-6 text-[12px] leading-relaxed text-[#6b6b6b]">
            {query
              ? `No videos match “${query}”.`
              : "No videos yet. Describe your product to make the first one."}
          </p>
        ) : (
          groups.map((g) => (
            <section key={g.label} className="mb-3">
              <h3 className="px-2.5 pb-1 text-[11px] font-medium text-[#6b6b6b]">
                {g.label}
              </h3>
              <ul className="flex flex-col gap-px">
                {g.items.map((p) => (
                  <VideoRow
                    key={p.id}
                    project={p}
                    active={p.id === projects.currentId}
                    renaming={renaming === p.id}
                    onOpen={() => void projects.openProject(p.id)}
                    onStartRename={() => setRenaming(p.id)}
                    onRename={(title) => {
                      setRenaming(null);
                      if (title !== p.title)
                        void projects.renameProject(p.id, title);
                    }}
                    onCancelRename={() => setRenaming(null)}
                    onDuplicate={() => void projects.duplicateProject(p.id)}
                    onDelete={() => setDeleting(p)}
                  />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>

      <div className="flex flex-col gap-px border-t border-[#1f1f1f] px-2 pt-2">
        <FooterLink href="/docs/components" icon={LayoutGrid}>
          Components
        </FooterLink>
        <FooterLink href="/docs/video-editor" icon={SquarePen}>
          Timeline editor
        </FooterLink>
        <FooterLink href={X_URL} icon={MessageSquare} external>
          Send feedback
        </FooterLink>
        <div className="mt-1 px-1.5">
          <UserMenu />
        </div>
      </div>

      <AlertDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <AlertDialogContent className="rounded-[18px] border-[#2a2a2a] bg-[#1a1a1a] text-[#eeeeee]">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleting?.title}”?</AlertDialogTitle>
            <AlertDialogDescription className="text-[#a0a0a0]">
              The video and its scenes are removed for good. This can't be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="border-0 bg-transparent">
            <AlertDialogCancel className="border-[#333] bg-transparent text-[#eeeeee] hover:bg-[#222]">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#e5484d] text-white hover:bg-[#dc3e42]"
              onClick={() => {
                if (deleting) void projects.removeProject(deleting.id);
                setDeleting(null);
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function VideoRow({
  project,
  active,
  renaming,
  onOpen,
  onStartRename,
  onRename,
  onCancelRename,
  onDuplicate,
  onDelete,
}: {
  project: ProjectSummary;
  active: boolean;
  renaming: boolean;
  onOpen: () => void;
  onStartRename: () => void;
  onRename: (title: string) => void;
  onCancelRename: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) inputRef.current?.select();
  }, [renaming]);

  if (renaming) {
    return (
      <li>
        <input
          ref={inputRef}
          defaultValue={project.title}
          aria-label="Video name"
          maxLength={80}
          onBlur={(e) => onRename(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") onRename(e.currentTarget.value);
            if (e.key === "Escape") onCancelRename();
          }}
          className="h-8 w-full rounded-[10px] border border-[#3a3a3a] bg-[#151515] px-2.5 text-[13px] text-[#eeeeee] outline-none focus:border-[#5a5a5a]"
        />
      </li>
    );
  }

  return (
    <li
      className={cn(
        "group relative flex h-8 items-center rounded-[10px] transition-colors",
        active ? "bg-[#232323]" : "hover:bg-[#1a1a1a]",
        menuOpen && !active && "bg-[#1a1a1a]",
      )}
    >
      <button
        type="button"
        onClick={onOpen}
        onDoubleClick={onStartRename}
        title={project.title}
        aria-current={active ? "page" : undefined}
        className={cn(
          "h-full min-w-0 flex-1 truncate rounded-[10px] pr-8 pl-2.5 text-left text-[13px]",
          active
            ? "text-[#f2f2f2]"
            : "text-[#bdbdbd] group-hover:text-[#eeeeee]",
        )}
      >
        {project.title}
      </button>
      <DropdownMenu open={menuOpen} onOpenChange={setMenuOpen}>
        <DropdownMenuTrigger
          aria-label={`Options for ${project.title}`}
          className={cn(
            "absolute right-1 grid size-6 place-items-center rounded-[8px] text-[#8a8a8a] transition-opacity hover:bg-[#2c2c2c] hover:text-[#eeeeee] focus-visible:opacity-100",
            active || menuOpen
              ? "opacity-100"
              : "opacity-0 group-hover:opacity-100",
          )}
        >
          <MoreHorizontal className="size-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="w-44 rounded-[12px] border border-[#2a2a2a] bg-[#1c1c1c] p-1 text-[#eeeeee] shadow-xl shadow-black/40 [&_svg.lucide]:[stroke-width:1.5]"
        >
          <DropdownMenuItem
            onClick={onStartRename}
            className="rounded-[8px] text-[13px] focus:bg-[#2a2a2a] focus:text-[#eeeeee]"
          >
            <Pencil className="size-3.5" />
            Rename
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onDuplicate}
            className="rounded-[8px] text-[13px] focus:bg-[#2a2a2a] focus:text-[#eeeeee]"
          >
            <Copy className="size-3.5" />
            Duplicate
          </DropdownMenuItem>
          <DropdownMenuSeparator className="bg-[#2a2a2a]" />
          <DropdownMenuItem
            variant="destructive"
            onClick={onDelete}
            className="rounded-[8px] text-[13px]"
          >
            <Trash2 className="size-3.5" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}

function SignedOutList({
  title,
  signedIn,
}: {
  title: string;
  signedIn: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex h-8 items-center rounded-[10px] bg-[#232323] px-2.5 text-[13px] text-[#f2f2f2]">
        <span className="truncate">{title}</span>
      </div>
      {!signedIn && (
        <div className="rounded-[14px] border border-[#232323] p-3">
          <p className="text-[12px] leading-relaxed text-[#a0a0a0]">
            This video lives in this browser only. Sign in to keep it, and every
            video you make, in your account.
          </p>
          <Link
            href="/signin?callbackUrl=%2Fstudio"
            className="mt-2.5 inline-flex h-7 items-center rounded-[8px] bg-[#eeeeee] px-2.5 text-[12px] font-medium text-[#111] transition-colors hover:bg-white"
          >
            Sign in
          </Link>
        </div>
      )}
    </div>
  );
}

function FooterLink({
  href,
  icon: Icon,
  external,
  children,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  external?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className="flex h-8 items-center gap-2.5 rounded-[10px] px-2.5 text-[13px] text-[#8a8a8a] transition-colors hover:bg-[#1a1a1a] hover:text-[#eeeeee]"
    >
      <Icon className="size-4" />
      {children}
    </Link>
  );
}
