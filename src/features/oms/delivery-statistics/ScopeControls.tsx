import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, Loader2 } from 'lucide-react'
import { takesEscape } from '@/core/commands/key-layer'
import { lookupQueries } from '@/core/services/lookups'
import Ltr from '@/core/ui/Ltr'
import { POPOVER } from '@/core/ui/overlay'
import { fsi } from '@/core/util/bidi'
import { withLeaveOutType, type StatisticsQuery } from './query'
import { orderTypeOptions, storeOptions, type ScopeOption } from './scope-options'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'

type Change = (change: (prev: StatisticsQuery) => StatisticsQuery) => void

/**
 * The control bar's scope (ticket 485): the store picker and the two leave-outs, mounted in 484's
 * control bar beside the period tabs. Everything lives in the URL, shared by all three tabs.
 *
 * - **Store:** the existing `storeDetails` lookup, each option one `code · city` pair; empty = all
 *   stores, the default.
 * - **Leave out** (ticked = left out, as on the till): Wasfaty churned refills, ticked by default,
 *   and the order types from the existing `documentTypes` lookup.
 */
export default function ScopeControls({ query, onChange }: { query: StatisticsQuery; onChange: Change }) {
  const { t } = useTranslation('delivery-statistics')
  const stores = useQuery(lookupQueries.storeDetails())
  const options = useMemo(() => storeOptions(stores.data), [stores.data])
  // A store read from a shared link that the list does not hold is still shown, so it can be undone.
  const listed = !query.store || options.some((o) => o.value === query.store) ? options : [{ value: query.store, text: query.store }, ...options]

  return (
    <>
      <Field
        label={t('scope.store')}
        error={
          stores.isError ? <span data-statistics-stores-failed="">{t('scope.storesFailed')}</span> : undefined
        }
      >
        <Select
          value={query.store}
          onChange={(e) => {
            const store = e.target.value
            onChange((q) => ({ ...q, store }))
          }}
          className="w-56"
          data-statistics-store=""
        >
          <option value="">{t('scope.allStores')}</option>
          {listed.map((o) => (
            // A native <option> takes only a string: the whole pair isolated once.
            <option key={o.value} value={o.value}>
              {fsi(o.text)}
            </option>
          ))}
        </Select>
      </Field>

      <fieldset className="flex flex-col gap-1 text-xs font-medium text-muted-foreground" data-statistics-leave-out="">
        <legend className="mb-1">{t('leaveOut.label')}</legend>
        <div className="flex h-7 items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-normal text-foreground">
            <input
              type="checkbox"
              checked={query.leaveOutChurned}
              onChange={(e) => {
                const leaveOutChurned = e.target.checked
                onChange((q) => ({ ...q, leaveOutChurned }))
              }}
              className="size-4 accent-primary"
              data-leave-out-churned=""
            />
            {t('leaveOut.churned')}
          </label>
          <OrderTypesPicker chosen={query.leaveOutTypes} onChange={onChange} />
        </div>
      </fieldset>
    </>
  )
}

/** The order types left out: a drop-down of checkboxes over the `documentTypes` lookup. */
function OrderTypesPicker({ chosen, onChange }: { chosen: readonly string[]; onChange: Change }) {
  const { t } = useTranslation('delivery-statistics')
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const types = useQuery(lookupQueries.documentTypes())
  const options = useMemo(() => orderTypeOptions(types.data), [types.data])

  // Close on a press outside the picker, or on an Escape that is the panel's to take (claimed, so
  // the layers under it and the screen's Esc command pass on it), handing focus back to the trigger.
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (!takesEscape(e, root.current)) return
      e.preventDefault()
      setOpen(false)
      trigger.current?.focus()
    }
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  // The list keeps its caption order whatever is ticked, so no row moves under the pointer. A chosen
  // code the list does not hold (a shared link) is drawn by its code at the top, so it can be taken off.
  const picked = new Set(chosen)
  const items: ScopeOption[] = [
    ...chosen.filter((code) => !options.some((o) => o.value === code)).map((code) => ({ value: code, text: code })),
    ...options,
  ]

  let status: string | null = null
  if (types.isPending) status = t('leaveOut.typesLoading')
  else if (types.isError) status = t('leaveOut.typesFailed')
  else if (items.length === 0) status = t('leaveOut.typesEmpty')

  return (
    <div ref={root} className="relative" data-leave-out-types="">
      <button
        ref={trigger}
        type="button"
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={() => setOpen(!open)}
        className={
          'inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs font-normal ' +
          (chosen.length > 0 ? 'border-primary bg-primary-050 text-primary-800' : 'border-border bg-card text-foreground')
        }
        data-leave-out-types-trigger=""
      >
        {t('leaveOut.types')}
        <span className="rounded-full bg-muted px-1.5 text-xs text-muted-foreground" data-leave-out-types-count="">
          {chosen.length > 0 ? <Ltr>{chosen.length}</Ltr> : t('leaveOut.none')}
        </span>
        <ChevronDown className="h-3 w-3 text-muted-foreground" aria-hidden />
      </button>
      {open && (
        <div
          role="dialog"
          aria-label={t('leaveOut.types')}
          className={`absolute end-0 top-full z-30 mt-1 flex w-72 flex-col gap-1.5 p-2 ${POPOVER}`}
          data-leave-out-types-panel=""
        >
          <ul className="max-h-64 overflow-auto">
            {items.map((o) => (
              <li key={o.value}>
                <label
                  className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-sm hover:bg-muted"
                  data-leave-out-type={o.value}
                  title={fsi(o.text)}
                >
                  <input
                    type="checkbox"
                    checked={picked.has(o.value)}
                    onChange={(e) => {
                      const leftOut = e.target.checked
                      onChange((q) => withLeaveOutType(q, o.value, leftOut))
                    }}
                    className="size-4 accent-primary"
                  />
                  {/* A description is free text in either script. */}
                  <bdi className="truncate">{o.text}</bdi>
                </label>
              </li>
            ))}
          </ul>
          {status && (
            <p className="inline-flex items-center gap-1.5 px-1.5 text-xs text-muted-foreground" data-leave-out-types-status="">
              {types.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {status}
            </p>
          )}
          {chosen.length > 0 && (
            <button
              type="button"
              onClick={() => onChange((q) => ({ ...q, leaveOutTypes: [] }))}
              className="self-end rounded-md px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted"
              data-leave-out-types-clear=""
            >
              {t('leaveOut.clear')}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
