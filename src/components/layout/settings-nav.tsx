"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { settingsNav } from "@/config/navigation";
import { cn } from "@/lib/utils";

export function SettingsNav() {
  const pathname = usePathname();

  return (
    <nav className="flex gap-1 overflow-x-auto md:w-48 md:shrink-0 md:flex-col md:overflow-visible">
      {settingsNav.map((item) => {
        const isActive = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex shrink-0 items-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium whitespace-nowrap transition-colors md:py-2",
              isActive
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
            )}
          >
            <item.icon className="size-4" />
            {item.title}
          </Link>
        );
      })}
    </nav>
  );
}
