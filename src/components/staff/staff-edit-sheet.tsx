"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil } from "lucide-react"
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
import { updateStaffMember } from "@/lib/staff/actions"
import { staffEditFormSchema, type StaffEditFormValues } from "@/lib/staff/schema"
import type { StaffMemberRow } from "@/lib/staff/queries"

const ROLE_OPTIONS: Array<{ value: StaffEditFormValues["role"]; label: string }> = [
  { value: "secretary", label: ROLE_LABELS.secretary },
  { value: "doctor", label: ROLE_LABELS.doctor },
  { value: "beauty_specialist", label: ROLE_LABELS.beauty_specialist },
  { value: "owner", label: ROLE_LABELS.owner },
]

function StaffEditSheet({ staff }: { staff: StaffMemberRow }) {
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<StaffEditFormValues>({
    resolver: zodResolver(staffEditFormSchema),
    defaultValues: { fullName: staff.fullName, phone: staff.phone ?? "", role: staff.role },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await updateStaffMember(staff.id, values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof StaffEditFormValues, { message })
          }
        }
        return
      }
      toast.success("Personel güncellendi.")
      setOpen(false)
    })
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="icon-sm" aria-label="Düzenle">
          <Pencil />
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Personeli Düzenle</SheetTitle>
          <SheetDescription>Ad soyad, telefon ve rol bilgilerini güncelleyin.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FieldGroup>
              <FormField
                control={form.control}
                name="fullName"
                label="Ad Soyad"
                render={({ field }) => <Input {...field} autoComplete="name" />}
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
                Kaydet
              </Button>
            </div>
          </form>
        </div>
      </SheetContent>
    </Sheet>
  )
}

export { StaffEditSheet }
