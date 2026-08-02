import { useEffect, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Trash2 } from 'lucide-react'

import { formatAmount } from '@/core/nphies/format'
import type { NphiesCodeSystemEntry } from '@/core/models/nphies'
import type { SessionLineView } from './auth-session'
import {
  DAYS_SUPPLY_MAX,
  DAYS_SUPPLY_MIN,
  daysSupplyEntry,
  maxCoverageEntry,
  selectionReasonEnabled,
  type CellVerdict,
} from './line-rules'

/**
 * The request's lines (tickets 217 · 218, spec 209 stories 27 · 29–37).
 *
 * 🚩 **Three of the agent's five inputs are on this grid** — quantity, Max
 * Coverage and Days Supply — plus Selection Reason, which is a code and not an
 * amount. Everything else in a row is the engine's and is drawn as a **value**:
 * unit price, extended, discount, net, VAT, patient share, the calculated
 * deductible and the deductible group. *The agent corrects the insurance terms,
 * never the merchandise or its price* — there is no item swap and no price or
 * discount override, here or in the contract (§2.2).
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
  onMaxCoverage,
  onDaysSupply,
  onSelectionReason,
  selectionReasons,
  busyLineId,
  disabled,
}: {
  lines: SessionLineView[]
  /** A new quantity, never a delta — the engine owns what the line holds. */
  onChangeQty: (lineId: string, quantity: number) => void
  onVoid: (lineId: string) => void
  /** The payer-share cap — `updateLineInsurance`. It can re-bucket sibling lines,
   *  because per-group caps share a pool. */
  onMaxCoverage: (lineId: string, maxPayerShare: number) => void
  /** `updateLineMeta`, validated 1–100 before it ever gets here. */
  onDaysSupply: (lineId: string, daysSupply: number) => void
  /** `updateLineMeta`. The code reaches NPHIES verbatim. */
  onSelectionReason: (lineId: string, selectionReason: string) => void
  /** `GET Nphies/CodeSystem?valueSet=SelectionReason` — **fetched, never spelled
   *  into the client**: a value set written out here is exactly the guessed shape
   *  spec 209 warns against. */
  selectionReasons: NphiesCodeSystemEntry[]
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
      {/* Named, because the form now holds two tables — this one and the header
          deductible block — and a screen reader landing in either deserves to
          know which. */}
      <table
        aria-label={t('form.lines.tableLabel')}
        className="w-full min-w-[84rem] border-collapse text-sm"
      >
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
            <Th className="text-end">{t('form.lines.deductible')}</Th>
            <Th>{t('form.lines.group')}</Th>
            {/* The three agent cells, kept together and after the engine's
                columns, so the boundary between what is derived and what is
                yours is a place on the row rather than a thing to remember. */}
            <Th className="w-32">{t('form.lines.maxCoverage')}</Th>
            <Th className="w-28">{t('form.lines.daysSupply')}</Th>
            <Th className="w-44">{t('form.lines.selectionReason')}</Th>
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
              <Money value={line.deductibleG} pending={line.pricingPending} />
              <Td className="text-xs">{line.deductibleGroupName}</Td>
              <Td>
                {line.editable ? (
                  <MaxCoverageCell
                    value={line.maxCoverage}
                    disabled={disabled || busyLineId === line.lineId}
                    onCommit={(cap) => onMaxCoverage(line.lineId, cap)}
                    label={t('form.lines.maxCoverageFor', { item: line.itemDescription })}
                  />
                ) : (
                  <span className="tabular-nums">{formatAmount(line.maxCoverage)}</span>
                )}
              </Td>
              <Td>
                {line.editable ? (
                  <DaysSupplyCell
                    value={line.daysSupply}
                    disabled={disabled || busyLineId === line.lineId}
                    onCommit={(days) => onDaysSupply(line.lineId, days)}
                    label={t('form.lines.daysSupplyFor', { item: line.itemDescription })}
                  />
                ) : (
                  <span className="tabular-nums">{line.daysSupply}</span>
                )}
              </Td>
              <Td>
                <SelectionReasonCell
                  value={line.selectionReason}
                  /* 🚩 Disabled on generic lines ONLY — the till's own rule, no
                     broader. A voided line offers nothing at all. */
                  enabled={line.editable && selectionReasonEnabled(line)}
                  generic={!selectionReasonEnabled(line)}
                  disabled={disabled || busyLineId === line.lineId}
                  options={selectionReasons}
                  onCommit={(code) => onSelectionReason(line.lineId, code)}
                  label={t('form.lines.selectionReasonFor', { item: line.itemDescription })}
                />
              </Td>
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

/**
 * **Max Coverage** — the engine's `MaxPayerShare`, agent-overridable (§4).
 *
 * 🚩 **A cap of zero will not apply**, so the cell says so instead of accepting
 * it. SIS.Pos ignores `<= 0` in `UpdateLineInsuranceInternalAsync`: a zero would
 * be typed, accepted, stored and silently do nothing, which is worse than either
 * taking effect or being refused. This is an inherited asymmetry carried
 * deliberately, not a bug fixed here.
 *
 * Setting it writes the payer-share cap so the **deductible stays derived** rather
 * than hand-set (story 34), and it can re-bucket sibling lines — per-group caps
 * share a pool — which is why the whole state comes back and the grid redraws.
 */
function MaxCoverageCell({
  value,
  disabled,
  onCommit,
  label,
}: {
  value: number
  disabled: boolean
  onCommit: (cap: number) => void
  label: string
}) {
  const { t } = useTranslation('authorizations')
  const [draft, setDraft] = useState(String(value))
  const [refusal, setRefusal] = useState<string | null>(null)
  /** Whether the agent has actually typed in this cell since the engine last
   *  answered — what separates *asking for a zero cap* from an untouched cell
   *  holding the engine's own default of zero. */
  const [typed, setTyped] = useState(false)

  // The engine's answer is the truth, exactly as on the quantity cell.
  useEffect(() => {
    setDraft(String(value))
    setRefusal(null)
    setTyped(false)
  }, [value])

  function commit() {
    const verdict: CellVerdict<'notANumber' | 'negative' | 'zeroWillNotApply'> = maxCoverageEntry(
      draft,
      value,
      typed,
    )
    if (verdict.kind === 'refused') {
      setRefusal(t(`form.lines.capRefusal.${verdict.reason}`))
      return
    }
    setRefusal(null)
    if (verdict.kind === 'send') onCommit(verdict.value)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="number"
        min={0}
        step="any"
        value={draft}
        aria-label={label}
        aria-invalid={refusal !== null}
        disabled={disabled}
        onChange={(e) => {
          setDraft(e.target.value)
          setTyped(true)
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className={
          'h-7 w-24 rounded-md border bg-background px-2 text-sm tabular-nums text-foreground disabled:opacity-50 ' +
          (refusal ? 'border-danger-border' : 'border-input')
        }
      />
      {refusal && (
        <span role="alert" className="text-[0.6875rem] text-attention-800 no-underline">
          {refusal}
        </span>
      )}
    </div>
  )
}

/**
 * **Days Supply**, validated **1–100 at the cell** (§2.3, story 36).
 *
 * 🚩 An out-of-range value is refused here, which is what makes it impossible for
 * one to exist. WPF swept them at submit — silently resetting to the header
 * default and then listing what it had changed in a warning dialog — and that
 * sweep and its dialog are **deleted, not ported**. There is no submit-time
 * reconciliation anywhere in this feature to find.
 *
 * The header default stamps each line as it lands (story 35), so the usual case
 * needs no per-line work at all.
 */
function DaysSupplyCell({
  value,
  disabled,
  onCommit,
  label,
}: {
  value: number
  disabled: boolean
  onCommit: (days: number) => void
  label: string
}) {
  const { t } = useTranslation('authorizations')
  const [draft, setDraft] = useState(String(value))
  const [refusal, setRefusal] = useState<string | null>(null)

  useEffect(() => {
    setDraft(String(value))
    setRefusal(null)
  }, [value])

  function commit() {
    const verdict = daysSupplyEntry(draft, value)
    if (verdict.kind === 'refused') {
      setRefusal(
        t(`form.lines.daysSupplyRefusal.${verdict.reason}`, {
          min: DAYS_SUPPLY_MIN,
          max: DAYS_SUPPLY_MAX,
        }),
      )
      return
    }
    setRefusal(null)
    if (verdict.kind === 'send') onCommit(verdict.value)
  }

  return (
    <div className="flex flex-col gap-0.5">
      <input
        type="number"
        min={DAYS_SUPPLY_MIN}
        max={DAYS_SUPPLY_MAX}
        step={1}
        value={draft}
        aria-label={label}
        aria-invalid={refusal !== null}
        disabled={disabled}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
        }}
        className={
          'h-7 w-20 rounded-md border bg-background px-2 text-sm tabular-nums text-foreground disabled:opacity-50 ' +
          (refusal ? 'border-danger-border' : 'border-input')
        }
      />
      {refusal && (
        <span role="alert" className="text-[0.6875rem] text-attention-800 no-underline">
          {refusal}
        </span>
      )}
    </div>
  )
}

/**
 * **Selection Reason** — a code, not an amount, and the only picker on the row.
 *
 * 🚩 **Disabled on generic lines only** (story 37), which is exactly the rule the
 * till applies and no broader: `NonMed` looks like it should be excluded and is
 * not. A disabled cell says *why* rather than sitting there greyed out, because a
 * control with no explanation is the trap this port exists to remove (story 24).
 *
 * ⚠️ **A quirk carried deliberately, not fixed.** On a `Brand-IR` line the agent
 * may pick a reason and the Nphies service **overwrites it at submit** with
 * `"innovative-noGeneric"`, and blanks the field entirely for items flagged
 * `RemoveSelectionReason` (`AuthService.cs:418-421`). The old screen behaves
 * identically. Reproduce it — someone who "fixed" it by hiding the picker would
 * change what reaches the payer.
 */
function SelectionReasonCell({
  value,
  enabled,
  generic,
  disabled,
  options,
  onCommit,
  label,
}: {
  value: string
  enabled: boolean
  generic: boolean
  disabled: boolean
  options: NphiesCodeSystemEntry[]
  onCommit: (code: string) => void
  label: string
}) {
  const { t } = useTranslation('authorizations')

  if (!enabled) {
    return (
      <span
        className="text-xs text-muted-foreground"
        title={generic ? t('form.lines.selectionReasonGeneric') : undefined}
      >
        {value || (generic ? t('form.lines.selectionReasonGenericShort') : '')}
      </span>
    )
  }

  return (
    <select
      value={value}
      aria-label={label}
      disabled={disabled || options.length === 0}
      onChange={(e) => onCommit(e.target.value)}
      className="h-7 w-40 rounded-md border border-input bg-background px-1.5 text-xs text-foreground disabled:opacity-50"
    >
      {/* The engine derives one; an empty value is a real state and stays
          selectable, because clearing a reason is the agent's to do. */}
      <option value="">{t('form.lines.selectionReasonNone')}</option>
      {/* ⚠ `Blocked` is a string upstream, not a boolean — carried as declared.
          A blocked code is one NPHIES no longer accepts, so it is not offered,
          unless the line already carries it (what was sent is what is shown). */}
      {options
        .filter((r) => !r.blocked || r.blocked.toLowerCase() === 'false' || r.code === value)
        .map((r) => (
          <option key={r.code} value={r.code}>
            {r.display || r.code}
          </option>
        ))}
      {/* A code the lookup does not carry is still what the line holds. Dropping
          it would silently reset the request's own value to blank. */}
      {value !== '' && !options.some((r) => r.code === value) && (
        <option value={value}>{value}</option>
      )}
    </select>
  )
}

function Th({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <th className={`px-2 py-2 text-start font-medium ${className}`}>{children}</th>
}

function Td({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <td className={`px-2 py-2 align-top ${className}`}>{children}</td>
}
