import {
  Building2,
  CalendarDays,
  LayoutDashboard,
  Plug,
  Settings,
  ShieldCheck,
  Stethoscope,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { Database } from "@/lib/supabase/database.types";

type StaffRole = Database["public"]["Enums"]["staff_role"];

export type NavLink = {
  title: string;
  href: string;
  icon: LucideIcon;
  /**
   * Sprint 25 (Project Rebirth) — a navigation audit found every role saw an
   * identical sidebar even though the app already gates page *content* by
   * role (e.g. Dashboard's financial cards). Personel and Ayarlar are pure
   * administrative/ownership concerns — a doctor or beauty specialist has no
   * real reason to visit either, and today both are 100% "Yakında"
   * placeholder content besides. Omit for a link every role should see.
   */
  restrictedTo?: StaffRole[];
};

export type NavGroup = {
  title: string;
  icon: LucideIcon;
  items: NavLink[];
};

export type NavEntry = NavLink | NavGroup;

export function isNavGroup(entry: NavEntry): entry is NavGroup {
  return "items" in entry;
}

/**
 * Single source of truth for the app sidebar. Flat by design — a nesting
 * group is only worth it once a genuinely related cluster of modules
 * exists under a label the user's own vocabulary would recognize.
 * `NavGroup`/`isNavGroup` stay in the type surface for that future case;
 * `mainNav` just doesn't use one now.
 */
export const mainNav: NavEntry[] = [
  { title: "Panel", href: "/dashboard", icon: LayoutDashboard },
  { title: "Hastalar", href: "/patients", icon: UserRound },
  { title: "Randevular", href: "/appointments", icon: CalendarDays },
  { title: "Personel", href: "/staff", icon: Users, restrictedTo: ["owner", "secretary"] },
  { title: "Ayarlar", href: "/settings", icon: Settings, restrictedTo: ["owner", "secretary"] },
];

/** Filters `mainNav` for a given role — clinical roles (doctor, beauty_specialist) don't see administrative-only links. */
export function visibleMainNav(role: StaffRole): NavEntry[] {
  return mainNav.filter((entry) => {
    if (isNavGroup(entry)) return true;
    return !entry.restrictedTo || entry.restrictedTo.includes(role);
  });
}

/** Settings sub-navigation — same NavLink shape, rendered as real routes, not tabs. */
export const settingsNav: NavLink[] = [
  { title: "Klinik", href: "/settings/clinic", icon: Building2 },
  { title: "Kullanıcılar", href: "/settings/users", icon: Users },
  { title: "Roller", href: "/settings/roles", icon: ShieldCheck },
  { title: "Tedavi Kataloğu", href: "/settings/treatments", icon: Stethoscope },
  { title: "Entegrasyonlar", href: "/settings/integrations", icon: Plug },
];

export type BreadcrumbSegment = { title: string; href?: string };

/**
 * Resolves one `NavLink` against `pathname`, handling both the exact-match
 * case (we're on the link's own page) and one level of dynamic sub-route
 * below it (`/leads/new`, `/leads/[id]`) via prefix matching. `dynamicLabel`
 * — the record's real name, supplied by the page itself via
 * `useDynamicBreadcrumb` since this function has no data access — fills the
 * trailing segment for an `[id]` route; a plain `/new` sub-route needs no
 * such label, "Yeni" is derivable from the path alone.
 */
function resolveLinkSegment(
  link: NavLink,
  pathname: string,
  dynamicLabel?: string,
): BreadcrumbSegment[] | null {
  if (link.href === pathname) {
    return [{ title: link.title }];
  }
  if (pathname.startsWith(`${link.href}/`)) {
    const suffix = pathname.slice(link.href.length + 1);
    if (suffix === "new") {
      return [{ title: link.title, href: link.href }, { title: "Yeni" }];
    }
    const trailingTitle = dynamicLabel ?? "Detay";
    return [{ title: link.title, href: link.href }, { title: trailingTitle }];
  }
  return null;
}

/**
 * Resolves a pathname into a breadcrumb trail by walking `mainNav` (including
 * group children) and, for `/settings/*`, `settingsNav`. Keeps the sidebar and
 * the header breadcrumb permanently in sync — there is nowhere else a route's
 * display title is defined.
 */
export function getBreadcrumbTrail(
  pathname: string,
  dynamicLabel?: string,
): BreadcrumbSegment[] {
  if (pathname.startsWith("/settings")) {
    const trail: BreadcrumbSegment[] = [
      { title: "Ayarlar", href: "/settings" },
    ];
    const child = settingsNav.find((item) => item.href === pathname);
    if (child) trail.push({ title: child.title });
    return trail;
  }

  for (const entry of mainNav) {
    if (isNavGroup(entry)) {
      for (const item of entry.items) {
        const segment = resolveLinkSegment(item, pathname, dynamicLabel);
        if (segment) return [{ title: entry.title }, ...segment];
      }
      continue;
    }
    const segment = resolveLinkSegment(entry, pathname, dynamicLabel);
    if (segment) return segment;
  }

  return [];
}
