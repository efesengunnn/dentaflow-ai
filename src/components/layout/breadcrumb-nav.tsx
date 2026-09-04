"use client";

import { usePathname } from "next/navigation";

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { useBreadcrumbContext } from "@/components/layout/breadcrumb-context";
import { getBreadcrumbTrail } from "@/config/navigation";

export function BreadcrumbNav() {
  const pathname = usePathname();
  const { label } = useBreadcrumbContext();
  const trail = getBreadcrumbTrail(pathname, label ?? undefined);

  if (trail.length === 0) return null;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {trail.map((segment, index) => {
          const isLast = index === trail.length - 1;
          return (
            <span
              key={segment.title}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <BreadcrumbItem>
                {isLast || !segment.href ? (
                  <BreadcrumbPage>{segment.title}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink href={segment.href}>
                    {segment.title}
                  </BreadcrumbLink>
                )}
              </BreadcrumbItem>
              {!isLast && <BreadcrumbSeparator />}
            </span>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
