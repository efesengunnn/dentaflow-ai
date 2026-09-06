"use client"

import { Printer } from "lucide-react"

import { Button } from "@/components/ui/button"

/** Madde G: "Yazdır desteği yeterli. Ek PDF kütüphanesi eklenmeyecek." — tarayıcının kendi print/PDF-kaydet akışı kullanılır. */
function PackagePrintButton() {
  return (
    <Button type="button" variant="outline" className="print-hidden" onClick={() => window.print()}>
      <Printer />
      Yazdır
    </Button>
  )
}

export { PackagePrintButton }
