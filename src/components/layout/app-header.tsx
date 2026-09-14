import { BreadcrumbNav } from "@/components/layout/breadcrumb-nav";
import { UserMenu } from "@/components/layout/user-menu";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/theme-toggle";

export function AppHeader({
  user,
}: {
  user: { name: string; role: string; showRole: boolean };
}) {
  return (
    <header className="bg-card/85 sticky top-0 z-10 flex h-16 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-sm sm:px-6">
      <SidebarTrigger size="icon-lg" className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <div className="hidden min-w-0 sm:block">
        <BreadcrumbNav />
      </div>
      <div className="ml-auto flex items-center gap-1 sm:gap-1.5">
        <ThemeToggle />
        <Separator orientation="vertical" className="mx-1.5 h-5" />
        <UserMenu name={user.name} role={user.role} showRole={user.showRole} />
      </div>
    </header>
  );
}
