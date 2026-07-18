import { useTranslation } from 'react-i18next'
import { Plus, Trash2 } from 'lucide-react'

// Ticket 013's BASIC items entry — enough to add rows (material, qty, UoM) and
// Process. Full inline-editable ag-grid parity (condition control, richer editing)
// is ticket 016, which replaces this table. Client sends items in order; the server
// assigns the item numbers.
export interface SimItemRow {
  id: string
  materialNumber: string
  quantity: string
  qtyUnit: string
}

// Monotonic row id — a plain counter, not crypto.randomUUID() (which is undefined
// in a non-secure browsing context and would throw on mount). Ids only need to be
// stable React keys within one screen life, not globally unique.
let rowSeq = 0

export function emptyItemRow(): SimItemRow {
  rowSeq += 1
  return { id: `row-${rowSeq}`, materialNumber: '', quantity: '1', qtyUnit: 'EA' }
}

interface Props {
  rows: SimItemRow[]
  onChange: (rows: SimItemRow[]) => void
  disabled?: boolean
}

export default function SimItemsEntry({ rows, onChange, disabled }: Props) {
  const { t } = useTranslation('simulation')

  const patch = (id: string, key: keyof SimItemRow, val: string) =>
    onChange(rows.map((r) => (r.id === id ? { ...r, [key]: val } : r)))

  const addRow = () => onChange([...rows, emptyItemRow()])
  const removeRow = (id: string) => onChange(rows.filter((r) => r.id !== id))

  const cellInput =
    'w-full rounded-md border border-input bg-background px-2 py-1 text-sm outline-none focus:border-primary disabled:opacity-60'

  return (
    <div className="rounded-lg border border-border/60 bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">{t('items.title')}</h2>
        <button
          type="button"
          onClick={addRow}
          disabled={disabled}
          className="inline-flex items-center gap-1 rounded-full border border-input px-3 py-1 text-xs font-medium hover:bg-accent disabled:opacity-60"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('items.addRow')}
        </button>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="text-start text-xs font-medium text-muted-foreground">
            <th className="border-b border-border px-2 py-1 text-start">{t('items.material')}</th>
            <th className="w-24 border-b border-border px-2 py-1 text-start">{t('items.quantity')}</th>
            <th className="w-24 border-b border-border px-2 py-1 text-start">{t('items.uom')}</th>
            <th className="w-10 border-b border-border px-2 py-1" aria-label={t('items.removeRow')} />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td className="border-b border-border px-2 py-1">
                <input
                  className={cellInput}
                  value={row.materialNumber}
                  disabled={disabled}
                  onChange={(e) => patch(row.id, 'materialNumber', e.target.value)}
                />
              </td>
              <td className="border-b border-border px-2 py-1">
                <input
                  className={cellInput}
                  type="number"
                  min="0"
                  value={row.quantity}
                  disabled={disabled}
                  onChange={(e) => patch(row.id, 'quantity', e.target.value)}
                />
              </td>
              <td className="border-b border-border px-2 py-1">
                <input
                  className={cellInput}
                  value={row.qtyUnit}
                  disabled={disabled}
                  onChange={(e) => patch(row.id, 'qtyUnit', e.target.value)}
                />
              </td>
              <td className="border-b border-border px-2 py-1 text-center">
                <button
                  type="button"
                  onClick={() => removeRow(row.id)}
                  disabled={disabled || rows.length === 1}
                  title={t('items.removeRow')}
                  aria-label={t('items.removeRow')}
                  className="text-muted-foreground hover:text-destructive disabled:opacity-30"
                >
                  <Trash2 className="h-4 w-4" aria-hidden />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
