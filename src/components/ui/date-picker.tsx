"use client"

import * as React from "react"
import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"

type DatePickerProps = {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
  disabled?: boolean
  className?: string
  /**
   * "dropdown" swaps the static month/year label for select dropdowns —
   * needed for fields like birth date where the user may have to jump
   * decades back, unusable one month-arrow-click at a time. Left as
   * "label" (default, unchanged) for near-today fields like appointment or
   * payment dates, where the existing arrow navigation is already fine.
   */
  captionLayout?: "label" | "dropdown"
}

function DatePicker({
  value,
  onChange,
  placeholder = "Tarih seçin",
  disabled,
  className,
  captionLayout = "label",
}: DatePickerProps) {
  const [open, setOpen] = React.useState(false)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start font-normal",
            !value && "text-muted-foreground",
            className
          )}
        >
          <CalendarIcon />
          {value ? format(value, "d MMMM yyyy", { locale: tr }) : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={(date) => {
            onChange?.(date)
            setOpen(false)
          }}
          locale={tr}
          captionLayout={captionLayout}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  )
}

export { DatePicker }
