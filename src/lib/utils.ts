import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * "Zeynep Kaya" → "ZK" — avatar-badge initials, used anywhere a person's
 * identity gets a small colored-circle chip (staff menu, patient profile
 * header, appointment rows). Extracted Sprint 21 once a third real call
 * site appeared (previously duplicated in `UserMenu` and started to repeat
 * again in the appointment-row redesign).
 */
export function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase()
}
