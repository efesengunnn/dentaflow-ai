"use client"

import * as React from "react"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type TimeSelectProps = {
  value?: string
  onChange?: (value: string) => void
  placeholder?: string
  disabled?: boolean
  /** Defaults cover a typical clinic day (08:00–19:45) in 15-minute steps — override per call site if needed. */
  startHour?: number
  endHour?: number
  stepMinutes?: number
}

/**
 * Generic "HH:MM" time-of-day picker — a `Select` of fixed slots rather than
 * a native `<input type="time">`, so a secretary clicks a slot instead of
 * typing (fewer input errors, consistent with the rest of the form UI). No
 * module dependency (mirrors `DatePicker`'s placement as a generic
 * `components/ui/` primitive) — the clinic-hours defaults live here as plain
 * props, not imported from `lib/appointments`.
 */
function TimeSelect({
  value,
  onChange,
  placeholder = "Saat seçin",
  disabled,
  startHour = 8,
  endHour = 20,
  stepMinutes = 15,
}: TimeSelectProps) {
  const slots = React.useMemo(() => {
    const result: string[] = []
    for (let minutes = startHour * 60; minutes < endHour * 60; minutes += stepMinutes) {
      const hour = String(Math.floor(minutes / 60)).padStart(2, "0")
      const minute = String(minutes % 60).padStart(2, "0")
      result.push(`${hour}:${minute}`)
    }
    return result
  }, [startHour, endHour, stepMinutes])

  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger className="w-full">
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {slots.map((slot) => (
          <SelectItem key={slot} value={slot}>
            {slot}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

export { TimeSelect }
