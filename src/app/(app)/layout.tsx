import { cookies } from "next/headers";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/layout/app-header";
import { AppSidebar } from "@/components/layout/app-sidebar";
import { BreadcrumbProvider } from "@/components/layout/breadcrumb-context";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { getCurrentStaffMember } from "@/lib/auth/get-current-staff-member";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const defaultOpen = cookieStore.get("sidebar_state")?.value !== "false";

  // Defense in depth: middleware (src/middleware.ts) already redirects
  // unauthenticated requests before they reach here. A null result with a
  // still-valid Supabase Auth session means the staff member was
  // deactivated/deleted mid-session — sign out here (not just redirect) so
  // the stale session cookie is cleared, otherwise middleware would just
  // bounce them straight back to this same layout.
  const staffMember = await getCurrentStaffMember();
  if (!staffMember) {
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect("/login");
  }

  return (
    <SidebarProvider defaultOpen={defaultOpen}>
      <BreadcrumbProvider>
        <AppSidebar clinicName={staffMember.clinicName} role={staffMember.role} />
        <SidebarInset>
          <AppHeader
            user={{
              name: staffMember.fullName,
              role: staffMember.roleLabel,
              showRole: staffMember.role === "owner",
            }}
          />
          <main className="flex flex-1 flex-col gap-6 p-4 md:p-6">
            {children}
          </main>
        </SidebarInset>
      </BreadcrumbProvider>
    </SidebarProvider>
  );
}
