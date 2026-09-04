"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition, type ReactNode } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import type { CatalogActionState } from "@/lib/treatment-catalog/actions"
import { TOOTH_TREATMENT_TYPE_OPTIONS } from "@/lib/teeth/constants"
import {
  treatmentCatalogItemFormDefaults,
  treatmentCatalogItemFormSchema,
  type TreatmentCatalogItemFormValues,
} from "@/lib/teeth/schema"

type TreatmentCatalogItemSheetProps = {
  mode: "create" | "edit"
  defaultValues?: Partial<TreatmentCatalogItemFormValues>
  onSubmit: (values: TreatmentCatalogItemFormValues) => Promise<CatalogActionState>
  trigger?: ReactNode
}

function TreatmentCatalogItemSheet({ mode, defaultValues, onSubmit, trigger }: TreatmentCatalogItemSheetProps) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const form = useForm<TreatmentCatalogItemFormValues>({
    resolver: zodResolver(treatmentCatalogItemFormSchema),
    defaultValues: { ...treatmentCatalogItemFormDefaults, ...defaultValues },
  })

  const handleSubmit = form.handleSubmit((values) => {
    setFormError(null)
    startTransition(async () => {
      const result = await onSubmit(values)
      if (result?.error) {
        setFormError(result.error)
        if (result.fieldErrors) {
          for (const [key, message] of Object.entries(result.fieldErrors)) {
            form.setError(key as keyof TreatmentCatalogItemFormValues, { message })
          }
        }
        return
      }
      toast.success(mode === "create" ? "İşlem eklendi." : "İşlem güncellendi.")
      setOpen(false)
      router.refresh()
    })
  })

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm">
            <Plus />
            İşlem Ekle
          </Button>
        )}
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>{mode === "create" ? "İşlem Ekle" : "İşlemi Düzenle"}</SheetTitle>
          <SheetDescription>Klinik fiyat listenize bir tedavi kalemi ekleyin.</SheetDescription>
        </SheetHeader>
        <div className="px-4 pb-4">
          <form onSubmit={handleSubmit} className="flex flex-col gap-6">
            <FieldGroup>
              <FormField
                control={form.control}
                name="treatmentType"
                label="İşlem Türü"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TOOTH_TREATMENT_TYPE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>
                          {option.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <FormField
                control={form.control}
                name="name"
                label="Görünen Ad"
                render={({ field }) => <Input {...field} placeholder="Örn. Kompozit Dolgu" />}
              />
              <FormField
                control={form.control}
                name="defaultPrice"
                label="Standart Ücret (opsiyonel)"
                render={({ field }) => (
                  <MoneyInput value={field.value} onChange={field.onChange} placeholder="Belirlenmedi" />
                )}
              />
              <label className="flex items-center gap-2 text-sm font-medium">
                <Checkbox
                  checked={form.watch("isActive")}
                  onCheckedChange={(checked) => form.setValue("isActive", checked === true)}
                />
                Aktif (Tedavi Ekle formunda görünür)
              </label>
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

export { TreatmentCatalogItemSheet }
