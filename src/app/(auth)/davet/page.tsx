"use client"

import { Sparkles } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { createClient } from "@/lib/supabase/client"

/**
 * Landing page for a staff-invite link (`generateLink({ type: 'invite' })`,
 * see `inviteStaffMember`). The Supabase Auth server redirects here with the
 * session tokens in the URL hash — `createClient()`'s browser client
 * auto-detects and persists them (`detectSessionInUrl`, on by default) on
 * mount, no server route handler needed. Once a session exists, the invited
 * person only ever sets their password; the `staff_members` row already
 * exists from the moment the owner sent the invite.
 */
export default function DavetPage() {
  const router = useRouter()
  const [status, setStatus] = useState<"checking" | "ready" | "invalid">("checking")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [isPending, setIsPending] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getSession().then(({ data }) => {
      setStatus(data.session ? "ready" : "invalid")
    })
  }, [])

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    if (password.length < 8) {
      setError("Şifre en az 8 karakter olmalı.")
      return
    }
    setError(null)
    setIsPending(true)
    const supabase = createClient()
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setIsPending(false)
    if (updateError) {
      setError("Şifre belirlenemedi. Bağlantının süresi dolmuş olabilir.")
      return
    }
    router.push("/dashboard")
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="bg-primary text-primary-foreground flex size-9 items-center justify-center rounded-lg">
            <Sparkles className="size-4.5" />
          </div>
          <h1 className="text-lg font-semibold tracking-tight">ClinicFlow AI</h1>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>Hesabınızı Kurun</CardTitle>
            <CardDescription>Devam etmek için bir şifre belirleyin.</CardDescription>
          </CardHeader>
          <CardContent>
            {status === "checking" && (
              <p className="text-muted-foreground text-sm">Davet bağlantınız kontrol ediliyor...</p>
            )}
            {status === "invalid" && (
              <p className="text-sm text-destructive">
                Bu davet bağlantısı geçersiz veya süresi dolmuş. Klinik sahibinizden yeni bir davet
                isteyin.
              </p>
            )}
            {status === "ready" && (
              <form onSubmit={handleSubmit}>
                <FieldGroup>
                  <Field>
                    <FieldLabel htmlFor="password">Şifre</FieldLabel>
                    <Input
                      id="password"
                      type="password"
                      autoComplete="new-password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                    />
                  </Field>
                  {error ? <FieldError>{error}</FieldError> : null}
                  <Button type="submit" loading={isPending} className="w-full">
                    Şifreyi Kaydet ve Devam Et
                  </Button>
                </FieldGroup>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
