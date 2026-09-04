"use server";

import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

export type LoginState = { error?: string } | undefined;

export async function login(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error, data } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: "E-posta veya şifre hatalı." };
  }

  // Deactivated/deleted staff can still authenticate against Supabase Auth
  // (their auth.users row is untouched by design — see the soft-delete
  // migration) but must not get a working session: reject here, before a
  // session cookie is even handed to the browser, rather than letting
  // (app)/layout.tsx bounce them back and forth against /login.
  const { data: staffMember } = await supabase
    .from("staff_members")
    .select("id")
    .eq("id", data.user.id)
    .eq("is_active", true)
    .is("deleted_at", null)
    .maybeSingle();

  if (!staffMember) {
    await supabase.auth.signOut();
    return { error: "Bu hesap artık aktif değil. Klinik yöneticinizle iletişime geçin." };
  }

  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
