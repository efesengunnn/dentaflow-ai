"use client"

import { Plus } from "lucide-react"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"

import { FormError } from "@/components/shared/form-error"
import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { FormField } from "@/components/ui/form-field"
import { Input } from "@/components/ui/input"
import { MoneyInput } from "@/components/ui/money-input"
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
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { CURRENCY_OPTIONS } from "@/lib/format/currency"
import { createCatalogItem, updateCatalogItem } from "@/lib/treatment-catalog/actions"
import { catalogItemFormSchema, type CatalogItemFormValues } from "@/lib/treatment-catalog/schema"
import type { CatalogItem } from "@/lib/treatment-catalog/queries"

type TreatmentCatalogItemSheetProps = {
  staffId: string
  staffName: string
  /** Present when editing an existing item; absent for "add new". */
  item?: CatalogItem
  trigger?: React.ReactNode
}

/** Shared add/edit form — Ayarlar > Tedavi Kataloğu, owner-only (enforced server-side by the actions themselves). */
function TreatmentCatalogItemSheet({ staffId, staffName, item, trigger }: TreatmentCatalogItemSheetProps) {
  const [open, setOpen] = useState(false)
  const isEditing = item !== undefined

  const form = useForm<CatalogItemFormValues>({
    resolver: zodResolver(catalogItemFormSchema),
    defaultValues: {
      staffId,
      treatmentType: item?.treatmentType ?? "",
      defaultPrice: item?.defaultPrice ?? undefined,
      currency: (item?.currency as "TRY" | "EUR" | undefined) ?? "TRY",
    },
  })

  const handleSubmit = form.handleSubmit(async (values) => {
    const result = isEditing
      ? await updateCatalogItem(item.id, {
          treatmentType: values.treatmentType,
          defaultPrice: values.defaultPrice,
          currency: values.currency,
        })
      : await createCatalogItem(values)

    if (result?.error) {
      toast.error(result.error)
      if (result.fieldErrors) {
        for (const [key, message] of Object.entries(result.fieldErrors)) {
          form.setError(key as keyof CatalogItemFormValues, { message })
        }
      }
      return
    }
    toast.success(isEditing ? "Tedavi güncellendi." : "Tedavi eklendi.")
    setOpen(false)
    if (!isEditing) form.reset({ staffId, treatmentType: "", defaultPrice: undefined, currency: "TRY" })
  })

  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) form.reset({ staffId, treatmentType: item?.treatmentType ?? "", defaultPrice: item?.defaultPrice ?? undefined, currency: (item?.currency as "TRY" | "EUR" | undefined) ?? "TRY" })
      }}
    >
      <SheetTrigger asChild>
        {trigger ?? (
          <Button size="sm" variant="outline">
            <Plus />
            Tedavi Ekle
          </Button>
        )}
      </SheetTrigger>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>{isEditing ? "Tedaviyi Düzenle" : "Yeni Tedavi Ekle"}</SheetTitle>
          <SheetDescription>{staffName} için tedavi türü ve önerilen fiyat.</SheetDescription>
        </SheetHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-6 px-4">
          <FieldGroup>
            <FormField
              control={form.control}
              name="treatmentType"
              label="Tedavi Türü"
              render={({ field }) => <Input {...field} placeholder="Örn. Botoks" />}
            />
            <FormField
              control={form.control}
              name="currency"
              label="Para Birimi"
              render={({ field }) => (
                <Select value={field.value} onValueChange={field.onChange}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCY_OPTIONS.map((option) => (
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
              name="defaultPrice"
              label="Önerilen Fiyat (opsiyonel)"
              render={({ field }) => <MoneyInput value={field.value} onChange={field.onChange} />}
            />
          </FieldGroup>
          <FormError message={form.formState.errors.root?.message ?? null} />
          <SheetFooter>
            <Button type="submit" loading={form.formState.isSubmitting}>
              {isEditing ? "Kaydet" : "Ekle"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  )
}

export { TreatmentCatalogItemSheet }
