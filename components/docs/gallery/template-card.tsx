"use client";

import { Lock } from "lucide-react";
import Link from "next/link";
import { CodeBlockCommand } from "@/components/docs/code-block-command";
import { buttonVariants } from "@/components/ui/button";
import { installCommand } from "@/config/site";
import { convertNpmCommand } from "@/lib/convert-npm-command";
import { CATALOGUE_PRICE } from "@/lib/plans";
import { cn } from "@/lib/utils";
import { TemplateReel } from "./template-reel";
import type { Reel } from "./template-reels";

/**
 * One template: the film with its beats, and the real install command — for
 * everyone. Seeing it is the sale; the paywall is the install itself.
 * `/r/<name>.json` serves a template only to a key with the Pro catalogue and
 * installs nothing for anyone else (`app/r/[file]/route.ts`), so the command
 * is safe to print. Without the catalogue, the card adds the unlock.
 */
export function TemplateCard({
  reel,
  install,
  unlocked,
}: {
  reel: Reel;
  /** Null until the template's registry item ships. */
  install: string | null;
  /** The reader's plan includes the Pro catalogue. */
  unlocked: boolean;
}) {
  return (
    <article>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <h2 className="font-semibold font-sans text-[clamp(1.75rem,3.2vw,2.5rem)] text-foreground leading-tight tracking-[-0.03em]">
            {reel.title}
          </h2>
          <p className="mt-3 text-pretty text-current/70 text-lg leading-relaxed">
            {reel.description}
          </p>
        </div>
        {unlocked ? null : (
          <Link
            href="/docs/pricing?ref=template-install#plans"
            className={cn(
              buttonVariants({ size: "lg" }),
              "h-12 shrink-0 gap-2.5 rounded-xl px-6 text-base transition-transform duration-150 ease-out active:scale-[0.97]",
            )}
          >
            <Lock aria-hidden className="size-5" />
            Unlock with Pro · {CATALOGUE_PRICE.annual}/yr
          </Link>
        )}
      </div>
      <div className="mt-8">
        <TemplateReel reel={reel} />
      </div>
      <div className="mt-6 max-w-xl">
        {install ? (
          <CodeBlockCommand
            component={install}
            variant="outline"
            {...convertNpmCommand(installCommand(install))}
          />
        ) : (
          // Listed before its registry item exists: say so rather than print
          // a command that would 404.
          <p className="text-muted-foreground text-sm">
            Its install command lands here when the template ships.
          </p>
        )}
        {unlocked ? null : (
          <p className="mt-3 flex items-center gap-1.5 text-muted-foreground text-sm">
            <Lock aria-hidden className="size-3.5" />
            Installs with a Pro key — without one, nothing is added.
          </p>
        )}
      </div>
    </article>
  );
}
