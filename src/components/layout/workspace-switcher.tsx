"use client";

import { Building2, ChevronsUpDown, Plus } from "lucide-react";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

// Single real clinic today (the signed-in user's own, via
// getCurrentStaffMember). Multi-clinic switching is Phase 4 (see
// docs/ROADMAP.md) — the dropdown affordance already exists so wiring real
// additional clinics in later is a data change, not a redesign.
export function WorkspaceSwitcher({ clinicName }: { clinicName: string }) {
  const clinics = [{ id: "current", name: clinicName }];
  const activeClinic = clinics[0];

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="rounded-xl bg-muted/50 data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <div className="bg-primary text-primary-foreground flex aspect-square size-8 items-center justify-center rounded-lg shadow-xs">
                <Building2 className="size-4" />
              </div>
              <div className="grid min-w-0 flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {activeClinic.name}
                </span>
                <span className="text-muted-foreground truncate text-xs">
                  Çalışma Alanı
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56"
            align="start"
          >
            <DropdownMenuLabel className="text-muted-foreground text-xs">
              Klinikler
            </DropdownMenuLabel>
            {clinics.map((clinic) => (
              <DropdownMenuItem key={clinic.id} className="gap-2">
                <div className="bg-primary text-primary-foreground flex size-6 items-center justify-center rounded-md">
                  <Building2 className="size-3.5" />
                </div>
                {clinic.name}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem disabled className="gap-2">
              <div className="flex size-6 items-center justify-center rounded-md border border-dashed">
                <Plus className="size-3.5" />
              </div>
              Klinik ekle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
