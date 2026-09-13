import { BrandMark } from "@/components/layout/brand-mark";
import { NavMain } from "@/components/layout/nav-main";
import { WorkspaceSwitcher } from "@/components/layout/workspace-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";
import type { Database } from "@/lib/supabase/database.types";

type StaffRole = Database["public"]["Enums"]["staff_role"];

export function AppSidebar({ clinicName, role }: { clinicName: string; role: StaffRole }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-4 pt-2">
        <div className="flex items-center gap-2.5 px-2 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-0">
          <div className="bg-primary text-primary-foreground flex size-7 shrink-0 items-center justify-center rounded-xl shadow-xs">
            <BrandMark className="size-4" />
          </div>
          <span className="text-[0.95rem] font-semibold tracking-tight group-data-[collapsible=icon]:hidden">
            DentaFlow <span className="text-primary">AI</span>
          </span>
        </div>
        <WorkspaceSwitcher clinicName={clinicName} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain role={role} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
