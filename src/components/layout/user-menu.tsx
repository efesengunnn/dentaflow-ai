"use client";

import { ChevronDown, LogOut, User } from "lucide-react";

import { signOut } from "@/lib/actions/auth";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getInitials } from "@/lib/utils";

export function UserMenu({
  name,
  role,
  showRole,
}: {
  name: string;
  role: string;
  showRole: boolean;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          className="h-11 min-w-0 gap-2.5 rounded-xl px-2 has-[>svg]:px-2"
        >
          <Avatar className="ring-primary/12 size-8 shrink-0 ring-2">
            <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <span className="hidden max-w-32 flex-col items-start text-left leading-tight sm:flex">
            <span className="truncate text-sm font-semibold">{name}</span>
            {showRole && (
              <span className="text-muted-foreground truncate text-xs">{role}</span>
            )}
          </span>
          <ChevronDown className="text-muted-foreground hidden size-3.5 shrink-0 sm:block" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium">{name}</span>
            {showRole && (
              <span className="text-muted-foreground text-xs">{role}</span>
            )}
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem disabled>
          <User />
          Profil
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={() => signOut()}>
          <LogOut />
          Çıkış Yap
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
