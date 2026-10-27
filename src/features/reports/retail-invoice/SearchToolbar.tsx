import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Search } from 'lucide-react'
import type { InvoiceCriteria } from './invoice-criteria'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

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
      <Field
        label={
          <>
            {t('invoice.search.trxNumber')}{' '}
            {/* The one required field, marked before it is refused rather than
                after — the `*` follows `NewRoleModal`'s precedent and is a glyph,
                not a sentence, so it needs no key. `aria-required` on the input
                below says the same thing to a screen reader. */}
            <span className="text-danger-800" aria-hidden>
              *
            </span>
          </>
        }
      >
        <Input
          ref={numberRef}
          aria-required
          type="text"
          inputMode="numeric"
          value={criteria.trxNumber}
          onChange={(e) => onChange({ trxNumber: e.target.value })}
          placeholder={t('invoice.search.trxNumberPlaceholder')}
          aria-invalid={invalid || undefined}
          aria-describedby={invalid ? 'invoice-trx-number-error' : undefined}
          className="w-56 font-mono"
        />
      </Field>

      <Field label={t('invoice.search.storeCode')}>
        <Input
          type="text"
          value={criteria.storeCode}
          onChange={(e) => onChange({ storeCode: e.target.value })}
          placeholder={t('invoice.search.storeCodePlaceholder')}
          className="w-32"
        />
      </Field>

      <div className="flex items-center gap-2">
        <Button type="submit" variant="primary">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('invoice.search.submit')}
        </Button>
        <Button type="button" variant="outlined" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('invoice.search.reset')}
        </Button>
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
