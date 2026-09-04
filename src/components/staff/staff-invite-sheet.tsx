"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { CheckIcon, CopyIcon, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ROLE_LABELS } from "@/lib/staff/constants"
import { inviteStaffMember } from "@/lib/staff/actions"
import { staffInviteFormDefaults, staffInviteFormSchema, type StaffInviteFormValues } from "@/lib/staff/schema"

const ROLE_OPTIONS: Array<{ value: StaffInviteFormValues["role"]; label: string }> = [
  { value: "secretary", label: ROLE_LABELS.secretary },
  { value: "doctor", label: ROLE_LABELS.doctor },
  { value: "beauty_specialist", label: ROLE_LABELS.beauty_specialist },
  { value: "owner", label: ROLE_LABELS.owner },
]

function StaffInviteSheet() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<StaffInviteFormValues>({
    resolver: zodResolver(staffInviteFormSchema),
    defaultValues: staffInviteFormDefaults,
  })

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (!next) {
      // Refresh only on close, not right after invite succeeds — the sheet
      // stays open to show the copyable link, and refreshing the list any
      // earlier would remount this component out from under that link. See
      // the comment on inviteStaffMember (src/lib/staff/actions.ts).
      if (inviteLink) router.refresh()
      form.reset(staffInviteFormDefaults)
      setInviteLink(null)
      setFormError(null)
      setCopied(false)
    }
  }

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await inviteStaffMember(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof StaffInviteFormValues, { message })
          }
        }
        return
      }
      toast.success("Personel davet edildi.")
      if (result?.success) setInviteLink(result.inviteLink ?? null)
    })
  })

  async function handleCopyLink() {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        <Button>
          <UserPlus />
          Personel Davet Et
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Personel Davet Et</SheetTitle>
          <SheetDescription>
            Ekip üyenizin bilgilerini girin. Hesabını kurması için bir davet bağlantısı oluşturulacak.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          {inviteLink ? (
            <div className="flex flex-col gap-4">
              <p className="text-sm text-muted-foreground">
                Davet bağlantısı oluşturuldu. E-posta ulaşmazsa bu bağlantıyı ekip üyenizle doğrudan
                paylaşabilirsiniz — bağlantı yalnızca bir kez şifre belirlemek için kullanılabilir.
              </p>
              <div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3">
                <span className="min-w-0 flex-1 truncate font-mono text-xs">{inviteLink}</span>
                <Button type="button" variant="outline" size="icon-sm" onClick={handleCopyLink}>
                  {copied ? <CheckIcon /> : <CopyIcon />}
                </Button>
              </div>
              <Button type="button" onClick={() => handleOpenChange(false)}>
                Tamam
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-6">
              <FieldGroup>
                <FormField
                  control={form.control}
                  name="fullName"
                  label="Ad Soyad"
                  render={({ field }) => <Input {...field} placeholder="Ayşe Yılmaz" autoComplete="name" />}
                />
                <FormField
                  control={form.control}
                  name="email"
                  label="E-posta"
                  render={({ field }) => (
                    <Input {...field} type="email" placeholder="ayse@klinik.com" autoComplete="email" />
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  label="Telefon (opsiyonel)"
                  render={({ field }) => (
                    <Input
                      {...field}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="5xxxxxxxxx"
                      onChange={(event) => field.onChange(event.target.value.replace(/\D/g, "").slice(0, 10))}
                    />
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  label="Rol"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger className="w-full">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLE_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </FieldGroup>

              <div className="bg-card sticky bottom-0 flex flex-col gap-3 border-t pt-4 pb-1">
                <FormError message={formError} />
                <Button type="submit" loading={isPending} className="w-full sm:w-fit">
                  Davet Gönder
                </Button>
              </div>
            </form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { StaffInviteSheet }
