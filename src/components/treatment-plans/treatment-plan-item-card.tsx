"use client"

import { format } from "date-fns"
import { tr } from "date-fns/locale"
import { Pencil, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { EntityDeleteDialog } from "@/components/shared/entity-delete-dialog"
import { InfoGrid } from "@/components/shared/info-grid"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Separator } from "@/components/ui/separator"
import type { AssignableStaff } from "@/lib/staff/queries"
import { deleteTreatmentPlanItem, deleteTreatmentSession } from "@/lib/treatment-plans/actions"
import { TREATMENT_SESSION_STATUS_BADGE_VARIANT, TREATMENT_SESSION_STATUS_LABELS } from "@/lib/treatment-plans/constants"
import {
  canCompleteSession,
  canCorrectOrVoidSession,
  canDeleteTreatmentPlanItem,
  canDeleteTreatmentSession,
  type TreatmentPlanActor,
} from "@/lib/treatment-plans/permissions"
import { formatCurrency } from "@/lib/format/currency"
import type { TreatmentPlanItemDetail, TreatmentSessionRow } from "@/lib/treatment-plans/queries"
import { CompleteSessionSheet } from "./complete-session-sheet"
import { SessionCorrectionSheet } from "./session-correction-sheet"
import { SessionVoidDialog } from "./session-void-dialog"
import { TreatmentPlanStatusBadge } from "./treatment-plan-status-badge"

function formatMoney(amount: number | null, currency: string): string {
  return amount === null ? "Belirlenmedi" : formatCurrency(amount, currency)
}

/**
 * One completed/corrected/voided visit within an item's "Seans Geçmişi".
 * Correct/Void/Delete are three distinct actions, all gated by the same
 * `canCorrectOrVoidSession` authority (only ever offered on a `completed`
 * row — corrected/voided are terminal): Correct rewrites the outcome (a new
 * replacement session), Void marks it as never-happened in place, Delete
 * (Sprint 28C.1) only hides a real visit from active screens without
 * touching what it says happened.
 */
function SessionRow({
  session,
  actor,
  staffOptions,
}: {
  session: TreatmentSessionRow
  actor: TreatmentPlanActor
  staffOptions: AssignableStaff[]
}) {
  const router = useRouter()
  const correctable = {
    performedBy: session.performedById,
    createdAt: session.createdAt,
    status: session.status,
  }
  const canCorrectOrVoid = canCorrectOrVoidSession(actor, correctable)
  const canDelete = canDeleteTreatmentSession(actor, correctable)

  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span className="min-w-0 truncate">
        {session.sessionNumber}. seans · {session.performedByName} · {format(new Date(session.performedAt), "d MMM yyyy", { locale: tr })}
        {session.status === "corrected" && " — Düzeltilmiş kayıt"}
      </span>
      <div className="flex shrink-0 items-center gap-1.5">
        <Badge variant={TREATMENT_SESSION_STATUS_BADGE_VARIANT[session.status]}>
          {TREATMENT_SESSION_STATUS_LABELS[session.status]}
        </Badge>
        {canCorrectOrVoid && (
          <SessionCorrectionSheet session={session} staffOptions={staffOptions} onSuccess={() => router.refresh()} />
        )}
        {canCorrectOrVoid && <SessionVoidDialog session={session} />}
        {canDelete && (
          <EntityDeleteDialog
            title="Seans kaydı silinsin mi?"
            description="Bu seans kaydı aktif ekranlardan kaldırılır, kalan seans sayısına geri eklenir. Randevu kaydı etkilenmez."
            triggerIcon={Trash2}
            triggerVariant="ghost"
            triggerSize="icon-xs"
            triggerClassName="text-destructive hover:text-destructive"
            confirmVariant="destructive"
            requireReason
            reasonLabel="Silme sebebi"
            reasonPlaceholder="Bu seans kaydını neden siliyorsunuz?"
            onConfirm={async (reason) => {
              const result = await deleteTreatmentSession({ sessionId: session.id, reason })
              if (result?.success) {
                router.refresh()
                return undefined
              }
              return { error: result?.error ?? "Seans silinemedi." }
            }}
          />
        )}
      </div>
    </div>
  )
}

/**
 * Plan Detail Sheet'teki her kalem kartı — "Botoks / Sağlayıcı / 0/1
 * tamamlandı / 6.000 ₺ / Düzenle" düzeni. `provider_share` sadece
 * `isOwner` true ve değer mevcutsa gösterilir (founder kararı: sağlayıcının
 * kendisi bile göremez) — non-owner için bu satır InfoGrid'e hiç eklenmez,
 * DOM'da bile yer almaz.
 */
function TreatmentPlanItemCard({
  item,
  isOwner,
  actor,
  staffOptions,
  onEdit,
}: {
  item: TreatmentPlanItemDetail
  isOwner: boolean
  actor: TreatmentPlanActor
  staffOptions: AssignableStaff[]
  onEdit: () => void
}) {
  const router = useRouter()
  const progressPercent = item.sessionCount > 0 ? Math.min((item.completedSessions / item.sessionCount) * 100, 100) : 0
  const canComplete = item.status === "active" && item.remainingSessions > 0 && canCompleteSession(actor)

  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-2">
        <div className="flex items-center gap-x-4 gap-y-1">
          <span className="min-w-0 flex-1 truncate font-medium">{item.treatmentName}</span>
          <TreatmentPlanStatusBadge status={item.status} />
        </div>
        <p className="text-sm text-muted-foreground">{item.providerName}</p>
        <p className="text-sm text-muted-foreground">
          {item.completedSessions} / {item.sessionCount} Seans Tamamlandı
        </p>
        <Progress value={progressPercent} className="h-1.5" />

        <InfoGrid
          compact
          items={[
            { label: "Fiyat", value: formatMoney(item.totalPrice, item.currency) },
            { label: "Kalan Seans", value: item.remainingSessions },
            ...(isOwner && item.providerShareAmount != null
              ? [{ label: "Hekim Payı", value: formatMoney(item.providerShareAmount, item.currency) }]
              : []),
          ]}
        />

        {item.sessions.length > 0 && (
          <>
            <Separator />
            <div className="flex flex-col gap-1.5">
              {item.sessions.map((session) => (
                <SessionRow key={session.id} session={session} actor={actor} staffOptions={staffOptions} />
              ))}
            </div>
          </>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" size="sm" className="self-start" onClick={onEdit}>
            <Pencil />
            Düzenle
          </Button>
          {canComplete && (
            <CompleteSessionSheet
              treatmentPlanItemId={item.id}
              treatmentName={item.treatmentName}
              nextSessionNumber={item.completedSessions + 1}
              staffOptions={staffOptions}
              defaultStaffId={actor.staffId}
              onSuccess={() => router.refresh()}
            />
          )}
          {canDeleteTreatmentPlanItem(actor) && (
            <EntityDeleteDialog
              title={`"${item.treatmentName}" kalemi silinsin mi?`}
              description="Bu kalem aktif ekranlardan kaldırılır. Plan ve tamamlanmış seansları etkilenmez, kayıt kalıcı olarak silinmez."
              triggerLabel="Kalemi Sil"
              triggerSize="sm"
              requireReason
              reasonLabel="Silme sebebi"
              reasonPlaceholder="Bu kalemi neden siliyorsunuz?"
              onConfirm={async (reason) => {
                const result = await deleteTreatmentPlanItem({ itemId: item.id, reason })
                if (result?.success) {
                  router.refresh()
                  return undefined
                }
                return { error: result?.error ?? "Tedavi kalemi silinemedi." }
              }}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export { TreatmentPlanItemCard }
