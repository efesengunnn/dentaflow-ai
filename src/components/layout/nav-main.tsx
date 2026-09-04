"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { isNavGroup, visibleMainNav } from "@/config/navigation";
import {
  SidebarGroup,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar";
import type { Database } from "@/lib/supabase/database.types";

type StaffRole = Database["public"]["Enums"]["staff_role"];

/**
 * `/leads` matches exactly, but `/leads/[id]` and `/leads/new` need to keep
 * the same sidebar item (and its parent CRM group) highlighted too — a
 * plain `===` check loses the highlight entirely on the app's most-visited
 * pages. Same prefix-matching principle as `getBreadcrumbTrail`
 * (`config/navigation.ts`), applied here for the same reason.
 */
function isLinkActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function NavMain({ role }: { role: StaffRole }) {
  const pathname = usePathname();

  return (
    <SidebarGroup>
      <SidebarMenu>
        {visibleMainNav(role).map((entry) => {
          if (isNavGroup(entry)) {
            const groupActive = entry.items.some((item) =>
              isLinkActive(pathname, item.href),
            );
            return (
              <SidebarMenuItem key={entry.title}>
                <SidebarMenuButton
                  className="cursor-default font-medium hover:bg-transparent active:bg-transparent"
                  data-active={groupActive}
                >
                  <entry.icon />
                  <span>{entry.title}</span>
                </SidebarMenuButton>
                <SidebarMenuSub>
                  {entry.items.map((item) => (
                    <SidebarMenuSubItem key={item.href}>
                      <SidebarMenuSubButton
                        asChild
                        isActive={isLinkActive(pathname, item.href)}
                      >
                        <Link href={item.href}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuSubButton>
                    </SidebarMenuSubItem>
                  ))}
                </SidebarMenuSub>
              </SidebarMenuItem>
            );
          }

          return (
            <SidebarMenuItem key={entry.href}>
              <SidebarMenuButton
                asChild
                isActive={isLinkActive(pathname, entry.href)}
              >
                <Link href={entry.href}>
                  <entry.icon />
                  <span>{entry.title}</span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          );
        })}
      </SidebarMenu>
    </SidebarGroup>
  );
}
