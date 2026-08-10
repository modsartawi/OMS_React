import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Search } from 'lucide-react'
import type { InvoiceCriteria } from './invoice-criteria'

/**
 * The Invoices toolbar (ticket 264) — **one required field and one optional
 * one**, and that is the whole screen's input.
 *
 * ⚠️ **Copied, not extracted** from `pricing/bonus-buy-inquiry/SearchToolbar.tsx`
 * (spec 261 templates the screen on it): a feature may not import a feature, and
 * the shared inquiry shell stays ruled out.
 *
 * 🚩 It renders a **draft**. Nothing here fires a query — the form's submit hands
 * the draft to the Page, which promotes it through `buildInvoiceSearchParams`.
 * A half-typed transaction number therefore cannot reach the server, and Enter
 * submits because a one-field lookup that needed the mouse would be slower than
 * the till.
 *
 * ⚠️ No date pickers, no "active only", no filtered chip: the transaction number
 * already encodes the store, the till and the timestamp (contract §3), so there
 * is nothing else to narrow by.
 */
export default function SearchToolbar({
  criteria,
  onChange,
  onSearch,
  onReset,
  invalid,
}: {
  criteria: InvoiceCriteria
  onChange: (patch: Partial<InvoiceCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** True once Search was pressed on a blank number — the LOCAL refusal, which
   *  is why `400 TRX_NUMBER_REQUIRED` is unreachable from this client. */
  invalid: boolean
}) {
  const { t } = useTranslation('reports')

  // Focus lands on the number field on mount: the screen opens with nothing to
  // read and exactly one thing to do.
  const numberRef = useRef<HTMLInputElement>(null)
  useEffect(() => {
    numberRef.current?.focus()
  }, [])

  return (
    <form
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
      onSubmit={(e) => {
        e.preventDefault()
        onSearch()
      }}
    >
      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        <span>
          {t('invoice.search.trxNumber')}{' '}
          {/* The one required field, marked before it is refused rather than
              after — the `*` follows `NewRoleModal`'s precedent and is a glyph,
              not a sentence, so it needs no key. `aria-required` on the input
              below says the same thing to a screen reader. */}
          <span className="text-danger-800" aria-hidden>
            *
          </span>
        </span>
        <input
          ref={numberRef}
          aria-required
          type="text"
          inputMode="numeric"
          value={criteria.trxNumber}
          onChange={(e) => onChange({ trxNumber: e.target.value })}
          placeholder={t('invoice.search.trxNumberPlaceholder')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'invoice-trx-number-error' : undefined}
          className={`h-9 w-56 rounded-md border bg-background px-2.5 font-mono text-sm text-foreground focus:outline-none ${
            invalid ? 'border-danger-border' : 'border-border/60 focus:border-primary/50'
          }`}
        />
      </label>

      <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
        {t('invoice.search.storeCode')}
        <input
          type="text"
          value={criteria.storeCode}
          onChange={(e) => onChange({ storeCode: e.target.value })}
          placeholder={t('invoice.search.storeCodePlaceholder')}
          className="h-9 w-32 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
      </label>

      <div className="flex items-center gap-2">
        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('invoice.search.submit')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('invoice.search.reset')}
        </button>
      </div>

      {/* The local refusal, said beside the field it is about rather than as a
          banner: it is a thing to type, not a failure that happened. */}
      {invalid && (
        <p id="invoice-trx-number-error" role="alert" className="text-xs font-medium text-danger-800">
          {t('invoice.search.required')}
        </p>
      )}
    </form>
  )
}
