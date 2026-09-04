import type { LucideIcon } from "lucide-react";

import { EmptyState } from "@/components/shared/empty-state";
import { PageContainer } from "@/components/shared/page-container";
import { Badge } from "@/components/ui/badge";

type ModulePlaceholderProps = {
  title: string;
  description: string;
  icon: LucideIcon;
  emptyTitle: string;
  emptyDescription: string;
};

/**
 * Shared shell for not-yet-built modules (Sprint 1 placeholder pages).
 *
 * Project Phoenix — previously reused the full `PageHeader` (a hero-scale
 * title meant for real content pages) and the same tinted `EmptyState` a
 * genuinely-empty-but-real list uses, so a roadmap page and "you have zero
 * patients yet" were visually identical apart from a small badge. Now: a
 * compact inline header (no hero-scale title for a page with no real
 * content to anchor), and `EmptyState`'s `tone="roadmap"` swaps the icon
 * badge to a plain muted/outline treatment — "not built yet" now reads
 * differently from "no records yet" at a glance, not just in the copy.
 */
export function ModulePlaceholder({
  title,
  description,
  icon,
  emptyTitle,
  emptyDescription,
}: ModulePlaceholderProps) {
  return (
    <PageContainer>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
          <p className="text-muted-foreground text-sm">{description}</p>
        </div>
        <Badge variant="secondary">Yakında</Badge>
      </div>
      <EmptyState
        icon={icon}
        title={emptyTitle}
        description={emptyDescription}
        tone="roadmap"
      />
    </PageContainer>
  );
}
