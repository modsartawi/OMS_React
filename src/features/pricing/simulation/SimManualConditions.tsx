import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'

// Ticket 016's manual-conditions grid — operator-entered conditions that ride the
// SimulateRequest alongside the basket. Each row is a (item number, condition type,
// rate, rate unit): the item number references the server's (position)*10 scheme, or
// 0 for a header/group condition (the engine coerces header-only condition types to
// 0 anyway). Only rows with a condition type are sent; a blank grid sends nothing.
//
// Ticket 120 folds it into the Items frame as a **disclosure with no frame of its
// own** — Items and manual conditions are one instrument, and a fourth frame for
// four inputs was one of the eleven the rework reclaims.
export interface SimManualConditionRow {
  id: string
  itemNumber: string
  conditionType: string
  rate: string
  rateUnit: string
}

// Monotonic row id — same rationale as the items grid: a plain counter, not
// crypto.randomUUID() (undefined in a non-secure context), stable within one screen.
let rowSeq = 0

export function emptyManualConditionRow(): SimManualConditionRow {
  rowSeq += 1
  return { id: `mc-${rowSeq}`, itemNumber: '0', conditionType: '', rate: '', rateUnit: '%' }
}

interface Props {
  rows: SimManualConditionRow[]
  onChange: (rows: SimManualConditionRow[]) => void
  disabled?: boolean
}

export default function SimManualConditions({ rows, onChange, disabled }: Props) {
  const { t } = useTranslation('simulation')

  // The disclosure OPENS ITSELF whenever rows exist, and cannot be shut while they
  // do (spec 110 story 24). The grid's own default item number — `0` — is a value
  // the server rejects (`INVALID_CONDITION_ITEM_LEVEL`, 098 finding 6), so a manual
  // condition behind a closed twisty is the difference between an explicable run
  // and an inexplicable 400. `open` is therefore derived, not stored: the local
  // state only decides what an EMPTY disclosure does.
  const [emptyOpen, setEmptyOpen] = useState(false)
  const open = rows.length > 0 || emptyOpen

  const patch = (id: string, key: keyof SimManualConditionRow, val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)))

  const addRow = () => onChange([...rows, emptyManualConditionRow()])
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  const cellInput =
    'w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-60'
  // Numeric cells: drop the native spinner arrows — in this narrow grid they overlap
  // the first digit and add nothing (values are typed, not stepped).
  const numInput =
    cellInput +
    ' [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'

  // The label. While rows exist it is a plain heading, not a twisty: a control
  // whose only two states are "open" and "open" would be a dead affordance, and
  // the count is what tells you there is something there (story 25). Empty, it is
  // an ordinary toggle.
  const label = (
    <>
      {open ? (
        <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
      ) : (
        // A directional chevron, mirrored with the text rather than left pointing
        // back into the margin. Built in rather than left for 121's sweep, since
        // 121 mirrors what exists and this chevron did not exist then.
        <ChevronRight className="h-3.5 w-3.5 shrink-0 rtl:-scale-x-100" aria-hidden />
      )}
      {/* Semibold only when there is something behind it. Shut and empty this is a
          twisty, not a heading — and the pre-run screen's budget is ONE frame and
          ONE heading, which a second bold line would spend twice. */}
      <span className={`text-sm tracking-tight ${rows.length > 0 ? 'font-semibold' : 'font-medium'}`}>
        {t('manual.title')}
      </span>
      {rows.length > 0 ? (
        <span
          data-manual-count
          className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground"
        >
          {t('manual.count', { count: rows.length })}
        </span>
      ) : null}
    </>
  )

  return (
    <div data-manual-conditions={open ? 'open' : 'closed'} className="mt-3 border-t border-border/60 pt-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        {rows.length > 0 ? (
          <div className="flex items-center gap-1.5">{label}</div>
        ) : (
          <button
            type="button"
            data-manual-toggle
            aria-expanded={open}
            onClick={() => setEmptyOpen((o) => !o)}
            className="flex items-center gap-1.5 rounded-md text-start text-muted-foreground hover:text-foreground"
          >
            {label}
          </button>
        )}
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-input px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('manual.addRow')}
        </button>
      </div>

      {!open ? null : rows.length === 0 ? (
        <div className="px-1 py-2 text-xs text-muted-foreground">{t('manual.empty')}</div>
      ) : (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-start text-xs font-medium text-muted-foreground">
              <th className="w-20 border-b border-border px-2 py-1 text-start">{t('manual.item')}</th>
              <th className="border-b border-border px-2 py-1 text-start">{t('manual.type')}</th>
              <th className="w-24 border-b border-border px-2 py-1 text-start">{t('manual.rate')}</th>
              <th className="w-16 border-b border-border px-2 py-1 text-start">{t('manual.unit')}</th>
              <th className="w-10 border-b border-border px-2 py-1" aria-label={t('manual.removeRow')} />
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id}>
                <td className="border-b border-border px-2 py-1">
                  <input
                    className={numInput}
                    type="number"
                    min="0"
                    value={row.itemNumber}
                    disabled={disabled}
                    onChange={(e) => patch(row.id, 'itemNumber', e.target.value)}
                  />
                </td>
                <td className="border-b border-border px-2 py-1">
                  <input
                    className={cellInput}
                    value={row.conditionType}
                    disabled={disabled}
                    onChange={(e) => patch(row.id, 'conditionType', e.target.value)}
                  />
                </td>
                <td className="border-b border-border px-2 py-1">
                  <input
                    className={numInput}
                    type="number"
                    value={row.rate}
                    disabled={disabled}
                    onChange={(e) => patch(row.id, 'rate', e.target.value)}
                  />
                </td>
                <td className="border-b border-border px-2 py-1">
                  <input
                    className={cellInput}
                    value={row.rateUnit}
                    disabled={disabled}
                    onChange={(e) => patch(row.id, 'rateUnit', e.target.value)}
                  />
                </td>
                <td className="border-b border-border px-2 py-1 text-center">
                  <button
                    type="button"
                    onClick={() => removeRow(row.id)}
                    disabled={disabled}
                    title={t('manual.removeRow')}
                    aria-label={t('manual.removeRow')}
                    className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {open ? <p className="mt-2 text-[0.7rem] text-muted-foreground">{t('manual.itemHint')}</p> : null}
    </div>
  )
}
