import type { ReactNode } from "react"

/** A label/value pair for a Detail page's left-column info panel — used by Leads and Patients. */
function InfoRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-muted-foreground text-xs">{label}</span>
      <span className="text-sm">{value}</span>
    </div>
  )
}

export { InfoRow }
