import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Trash2 } from 'lucide-react'

import { formatAmount } from '@/core/nphies/format'
import type { SessionLineView } from './auth-session'

/**
 * The request's lines (ticket 217, spec 209 stories 27 · 29 · 30 · 31 · 32).
 *
 * 🚩 **Money is read-only here, and that is the correct intermediate state rather
 * than a gap.** The agent's five inputs land at 218; law 1 makes the amounts the
 * engine's either way, so nothing on this grid is an input except the quantity —
 * the one field §4 already assigns to the agent through a verb that exists.
 *
 * 🚩 **A voided line is drawn, not dropped.** The audit trail is the whole reason
 * the form drives an engine transaction, so the row stays, struck through and
 * inert, saying what was considered and withdrawn.
 *
 * A plain table rather than AG Grid: the rows are a handful, every cell is either
 * a server value or one control, and 215 already found that a grid rebuilding its
 * `columnDefs` mid-act throws keyboard focus to `<body>` — which on a quantity
 * cell would cost the agent the number they were typing.
 */
export default function RequestLines({
  lines,
  onChangeQty,
  onVoid,
  busyLineId,
  disabled,
}: {
  lines: SessionLineView[]
  /** A new quantity, never a delta — the engine owns what the line holds. */
  onChangeQty: (lineId: string, quantity: number) => void
  onVoid: (lineId: string) => void
  /** The line a verb is in flight for. Stated on the row rather than as a global
   *  spinner, because the agent needs to know WHICH line is working. */
  busyLineId: string | null
  disabled: boolean
}) {
  const { t } = useTranslation('authorizations')

  if (lines.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
        {t('form.lines.empty')}
      </p>
    )
  }

  return (
    <div className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full min-w-[60rem] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border/60 bg-card/60 text-xs font-medium text-muted-foreground">
            <Th className="w-10 text-end">{t('form.lines.sequence')}</Th>
            <Th>{t('form.lines.item')}</Th>
            <Th className="w-28">{t('form.lines.quantity')}</Th>
            <Th className="text-end">{t('form.lines.unitPrice')}</Th>
            <Th className="text-end">{t('form.lines.extendedPrice')}</Th>
            <Th className="text-end">{t('form.lines.discount')}</Th>
            <Th className="text-end">{t('form.lines.netAmount')}</Th>
            <Th className="text-end">{t('form.lines.vat')}</Th>
            <Th className="text-end">{t('form.lines.patientShare')}</Th>
            <Th>{t('form.lines.group')}</Th>
            <Th className="w-24">{t('form.lines.acts')}</Th>
          </tr>
        </thead>
        <tbody>
          {lines.map((line) => (
            <tr
              key={line.lineId}
              className={
                'border-b border-border/40 last:border-b-0 ' +
                (line.voided ? 'text-muted-foreground line-through' : '')
              }
            >
              <Td className="text-end tabular-nums">{line.sequence}</Td>
              <Td>
                <div className="flex flex-col">
                  <span className="font-medium">{line.itemDescription}</span>
                  <span className="text-xs text-muted-foreground">{line.itemNumber}</span>
                  {line.voided && (
                    <span className="mt-0.5 w-fit rounded-full border border-border px-1.5 text-[0.6875rem] no-underline">
                      {t('form.lines.voided')}
                    </span>
                  )}
                </div>
              </Td>
              <Td>
                {line.editable ? (
                  <QuantityCell
                    quantity={line.quantity}
                    disabled={disabled || busyLineId === line.lineId}
                    onCommit={(quantity) => onChangeQty(line.lineId, quantity)}
                    label={t('form.lines.quantityFor', { item: line.itemDescription })}
                  />
                ) : (
                  <span className="tabular-nums">{line.quantity}</span>
                )}
              </Td>
              {/* 🚩 Every cell below is one server field, formatted. Nothing is
                  summed, totalled or derived anywhere in this area (law 1). */}
              <Money value={line.unitPrice} pending={line.pricingPending} />
              <Money value={line.extendedPrice} pending={line.pricingPending} />
              <Money value={line.discountAmount} pending={line.pricingPending} />
              <Money value={line.netAmount} pending={line.pricingPending} />
              <Money value={line.vat} pending={line.pricingPending} />
              <Money value={line.actualPatientShare} pending={line.pricingPending} />
              <Td className="text-xs">{line.deductibleGroupName}</Td>
              <Td>
                {line.editable && (
                  <button
                    type="button"
                    onClick={() => onVoid(line.lineId)}
                    disabled={disabled || busyLineId === line.lineId}
                    title={t('form.lines.voidHint')}
                    className="inline-flex h-7 items-center gap-1 rounded-full border border-danger-border px-2 text-xs text-danger-800 hover:bg-danger-050 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busyLineId === line.lineId ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {t('form.lines.void')}
                  </button>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * One money cell — or the ⟳ that says it is **pricing in place** (story 27).
 *
 * 🚩 The pending flag is the engine's own `pricing` field, not a client guess
 * about how long an add takes. A line whose price has not settled says so; it
 * never renders a blank the agent has to interpret as either zero or missing.
 */
function Money({ value, pending }: { value: number; pending: boolean }) {
  const { t } = useTranslation('authorizations')
  return (
    <Td className="text-end tabular-nums">
      {pending ? (
        <span
          className="inline-flex items-center gap-1 text-xs text-muted-foreground no-underline"
          title={t('form.lines.pricing')}
        >
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          {t('form.lines.pricing')}
        </span>
      ) : (
        formatAmount(value)
      )}
    </Td>
  )
}

/**
 * The quantity, the one editable field on this grid (§4: `Quantity` is the
 * agent's, through `changeQty`).
 *
 * It commits on blur and on Enter rather than on every keystroke — a verb per
 * digit would put `12` on the wire as `1` then `12`, and the engine re-prices the
 * whole line each time. A value that has not changed sends nothing at all.
 */
function QuantityCell({
  quantity,
  disabled,
  onCommit,
  label,
}: {
  quantity: number
  disabled: boolean
  onCommit: (quantity: number) => void
  label: string
}) {
  const [draft, setDraft] = useState(String(quantity))

  // The engine's answer is the truth: when the projection comes back with a
  // different quantity — its own cap applied, or another tab's change — the cell
  // follows it rather than keeping what was typed.
  useEffect(() => setDraft(String(quantity)), [quantity])

  function commit() {
    const next = Number(draft)
    if (!Number.isInteger(next) || next < 1) {
      setDraft(String(quantity))
      return
    }
    if (next === quantity) return
    onCommit(next)
  }

  return (
    <input
      type="number"
      min={1}
      step={1}
      value={draft}
      aria-label={label}
      disabled={disabled}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          commit()
        }
      }}
      className="h-7 w-20 rounded-md border border-input bg-background px-2 text-sm tabular-nums text-foreground disabled:opacity-50"
    />
  )
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-start font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>
}
