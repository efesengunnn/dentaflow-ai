import { redirect } from "next/navigation"

// "Kullanıcılar" and "Personel" (top-level nav) both manage the same
// `staff_members` table — Sprint 26 built one real screen at `/staff`
// instead of two management UIs against the same data (see CLAUDE.md's
// "no component duplication" rule). This route stays reachable (bookmarks,
// direct links) but always forwards there.
export default function UsersSettingsPage() {
  redirect("/staff")
}
