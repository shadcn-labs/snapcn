"use client";

import {
  BookOpen,
  Check,
  Clapperboard,
  Copy,
  Eye,
  ScanSearch,
  Search,
  SlidersHorizontal,
} from "lucide-react";
import { useState } from "react";
import { CommandLine } from "@/components/command-line";
import { CopyButton } from "@/components/docs/copy-button";
import { MCP_CLIENT_ICONS } from "@/components/icons/mcp-client-icons";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useTrackEvent } from "@/lib/analytics";
import { CLIENTS, installPrompt, JOBS, type JobId } from "@/lib/mcp-clients";
import { cn } from "@/lib/utils";

const JOB_ICON: Record<JobId, typeof Search> = {
  search: Search,
  component: SlidersHorizontal,
  plan: Clapperboard,
  analyze: ScanSearch,
  preview: Eye,
  rules: BookOpen,
};

/** A labelled button that copies a whole prompt, not a one-line command. */
function CopyPrompt({
  value,
  label,
  onCopy,
  className,
}: {
  value: string;
  label: string;
  onCopy: () => void;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn("gap-1.5 text-muted-foreground", className)}
      onClick={() => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        onCopy();
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Copy className="size-3.5" aria-hidden="true" />
      )}
      {copied ? "Copied" : label}
    </Button>
  );
}

export function McpClients() {
  const trackEvent = useTrackEvent();

  return (
    <Tabs defaultValue={CLIENTS[0].id}>
      {/* Seven clients do not fit a phone's width; the row scrolls rather than
          wrapping, which would break the pill into two rounded rows. */}
      <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        <TabsList className="w-max">
          {CLIENTS.map((client) => {
            const Icon = MCP_CLIENT_ICONS[client.id];
            return (
              <TabsTrigger key={client.id} value={client.id}>
                {Icon ? <Icon /> : null}
                {client.label}
              </TabsTrigger>
            );
          })}
        </TabsList>
      </div>

      {CLIENTS.map((client) => (
        <TabsContent key={client.id} value={client.id} className="mt-4">
          <div className="flex items-center justify-between gap-4">
            <p className="text-muted-foreground text-sm">{client.where}</p>
            <CopyPrompt
              value={installPrompt(client)}
              label="Copy as prompt"
              onCopy={() =>
                trackEvent("mcp_copied", {
                  target: client.id,
                  kind: "install_prompt",
                })
              }
            />
          </div>

          {client.oneClick ? (
            <Button
              size="sm"
              className="mt-4"
              nativeButton={false}
              render={
                // biome-ignore lint/a11y/useAnchorContent: children come through Button
                <a
                  href={client.oneClick.href}
                  onClick={() =>
                    trackEvent("mcp_copied", {
                      target: client.id,
                      kind: "one_click",
                    })
                  }
                />
              }
            >
              {client.oneClick.label}
            </Button>
          ) : null}

          <div className="mt-4 flex flex-col gap-4">
            {client.steps.map((step) => (
              <div key={step.code}>
                {step.label ? (
                  <p className="mb-2 text-muted-foreground text-xs">
                    {step.label}
                  </p>
                ) : null}
                <CommandLine
                  command={step.code}
                  onCopy={() =>
                    trackEvent("mcp_copied", {
                      target: client.id,
                      kind: "install",
                    })
                  }
                />
              </div>
            ))}
          </div>

          {client.note ? (
            <p className="mt-3 text-muted-foreground text-xs">{client.note}</p>
          ) : null}
        </TabsContent>
      ))}
    </Tabs>
  );
}

export function McpJobs() {
  const trackEvent = useTrackEvent();

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {JOBS.map((job) => {
        const Icon = JOB_ICON[job.id];
        return (
          <div
            key={job.id}
            className="flex flex-col rounded-2xl border border-border bg-card p-5"
          >
            <div className="flex items-center gap-3">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-border bg-muted/40">
                <Icon
                  className="size-4 text-muted-foreground"
                  aria-hidden="true"
                />
              </span>
              <h3 className="font-medium text-foreground">{job.title}</h3>
            </div>
            <p className="mt-3 flex-1 text-muted-foreground text-sm">
              {job.description}
            </p>
            {/* A prompt is prose, not a command: CommandLine's break-all would
                split it mid-word. */}
            <div className="mt-4 flex items-start gap-2 rounded-lg border border-border bg-muted/40 p-3">
              <p className="min-w-0 flex-1 text-pretty text-foreground text-sm leading-relaxed">
                “{job.prompt}”
              </p>
              <CopyButton
                value={job.prompt}
                className="shrink-0"
                onCopy={() =>
                  trackEvent("mcp_copied", {
                    target: job.tool,
                    kind: "job_prompt",
                  })
                }
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
