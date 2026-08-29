import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Search } from 'lucide-react'
import type { LookupCriteria, MissingParts } from './lookup-key'

/**
 * The IDoc Inspector's lookup bar (ticket 296) — **two required fields**, and
 * that is the whole screen's input.
 *
 * ⚠️ **Copied, not extracted** from `reports/retail-invoice/SearchToolbar.tsx`
 * (spec 1386 templates this feature on that rail): a feature may not import a
 * feature, and the shared inquiry shell stays ruled out.
 *
 * 🚩 It renders a **draft**. Nothing here fires a lookup — the form's submit
 * hands the draft to the Page, which promotes it through `buildLookupKey`. A
 * half-typed transaction number therefore cannot reach the server, and Enter
 * submits because a two-field lookup that needed the mouse would be slower than
 * reading the SQL it replaces.
 *
 * 🚩 **Both fields carry the required marker**, which is the visible difference
 * from the invoices toolbar beside it: there the store narrows an already-unique
 * number, here it is half the key.
 */
export default function LookupToolbar({
  criteria,
  onChange,
  onLookup,
  onReset,
  invalid,
}: {
  criteria: LookupCriteria
  onChange: (patch: Partial<LookupCriteria>) => void
  onLookup: () => void
  onReset: () => void
  /** Which half was empty when Look up was pressed — the LOCAL refusal, which is
   *  why the server's blank-key 400 branch is unreachable from this client.
   *  `null` until it is pressed on an incomplete draft. */
  invalid: MissingParts | null
}) {
  const { t } = useTranslation('reports')

  // Focus lands on the store field on mount: the screen opens with nothing to
  // read and exactly one thing to do, starting at the key's first half.
  const storeRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    storeRef.current?.focus()
  }, [])

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onLookup()
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        <span>
          {t('idocInspector.lookup.store')}{' '}
          {/* Marked before it is refused rather than after — a glyph, not a
              sentence, so it needs no key (`NewRoleModal`'s precedent), and
              `aria-required` says the same thing to a screen reader. */}
          <span className="text-danger-800" aria-hidden>
            *
          </span>
        </span>
        <input
          ref={storeRef}
          aria-required
          type="text"
          value={criteria.store}
          onChange={(e) => onChange({ store: e.target.value })}
          placeholder={t('idocInspector.lookup.storePlaceholder')}
          aria-invalid={invalid?.store || undefined}
          // Its OWN half, not "a refusal happened": a correctly-filled store
          // field announced with the transaction number's error is worse than
          // silence, because a screen-reader user cannot see which is marked.
          aria-describedby={invalid?.store ? 'idoc-lookup-error' : undefined}
          className={`h-9 w-32 rounded-md border bg-background px-2.5 font-mono text-sm text-foreground focus:outline-none ${
            invalid?.store ? 'border-danger-border' : 'border-border/60 focus:border-primary/50'
          }`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        <span>
          {t('idocInspector.lookup.trxNumber')}{' '}
          <span className="text-danger-800" aria-hidden>
            *
          </span>
        </span>
        <input
          aria-required
          type="text"
          inputMode="numeric"
          value={criteria.trxNumber}
          onChange={(e) => onChange({ trxNumber: e.target.value })}
          placeholder={t('idocInspector.lookup.trxNumberPlaceholder')}
          aria-invalid={invalid?.trxNumber || undefined}
          aria-describedby={invalid?.trxNumber ? 'idoc-lookup-error' : undefined}
          className={`h-9 w-56 rounded-md border bg-background px-2.5 font-mono text-sm text-foreground focus:outline-none ${
            invalid?.trxNumber ? 'border-danger-border' : 'border-border/60 focus:border-primary/50'
          }`}
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('idocInspector.lookup.submit')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('idocInspector.lookup.reset')}
        </button>
      </div>

      {/* The local refusal, said beside the fields it is about rather than as a
          banner: it is a thing to type, not a failure that happened. One
          sentence for both halves, naming whichever is missing. */}
      {invalid && (
        <p id="idoc-lookup-error" role="alert" className="text-xs font-medium text-danger-800">
          {invalid.store && invalid.trxNumber
            ? t('idocInspector.lookup.requiredBoth')
            : invalid.store
              ? t('idocInspector.lookup.requiredStore')
              : t('idocInspector.lookup.requiredTrxNumber')}
        </p>
      )}
    </form>
  )
}
