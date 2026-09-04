import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type EmptyStateProps = {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  /** Denser variant for nesting inside a Sheet section, a card slot, or a single day cell — smaller icon, tighter padding, no dashed border. Same icon-circle/title/description/action structure, just smaller. */
  compact?: boolean;
  /**
   * Project Phoenix — "no records yet" (real data, genuinely empty) and
   * "this module isn't built yet" (`ModulePlaceholder`) were rendering
   * pixel-identical, the only differentiator a small "Yakında" badge easy to
   * miss. `tone="roadmap"` reads as "not here yet" rather than "you have
   * zero of these."
   *
   * Project Evolution V2 — the icon lost its tinted-square badge (the
   * design audit's most-cited generic-admin-panel tell) in favor of a
   * larger bare glyph; the `default`/`roadmap` distinction now lives in
   * color alone (brand primary vs. fully neutral) instead of a filled
   * background, consistent with every other de-chromed display surface.
   */
  tone?: "default" | "roadmap";
  className?: string;
};

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  compact = false,
  tone = "default",
  className,
}: EmptyStateProps) {
  const iconClassName = tone === "roadmap" ? "text-muted-foreground/50" : "text-primary/60"

  if (compact) {
    return (
      <div
        className={cn(
          "bg-muted/30 flex flex-col items-center justify-center gap-2.5 rounded-xl px-4 py-6 text-center",
          className,
        )}
      >
        <Icon className={cn("size-6", iconClassName)} aria-hidden="true" />
        <div className="space-y-0.5">
          <p className="text-sm font-medium">{title}</p>
          {description ? (
            <p className="text-muted-foreground max-w-sm text-xs text-balance">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "border-border bg-muted/20 flex flex-col items-center justify-center gap-3.5 rounded-2xl border border-dashed px-6 py-10 text-center sm:py-16",
        className,
      )}
    >
      <Icon className={cn("size-9", iconClassName)} aria-hidden="true" />
      <div className="space-y-1">
        <p className="text-sm font-medium">{title}</p>
        {description ? (
          <p className="text-muted-foreground max-w-sm text-sm text-balance">
            {description}
          </p>
        ) : null}
      </div>
      {action}
    </div>
  );
}
