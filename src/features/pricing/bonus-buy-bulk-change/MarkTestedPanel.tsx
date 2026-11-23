import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiErrorMessage } from '@/core/api'
import type { BbyBulkListRow } from '@/core/models/bonus-buy-bulk'
import { usePermissions } from '@/core/permissions'
import { confirmAction } from '@/core/services/confirm'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { bbyBulkChangeApi } from './api'
import {
  BULK_TEST_NOTE_MAX,
  canMarkBulkTested,
  markTestedRequest,
  markTestedTargets,
  readMarkTested,
  type MarkOutcome,
  type MarkTestedReading,
} from './mark-tested'
import { Refusals } from './ResultPanel'
import { BULK_CAP } from './selection'

const BAR = 'flex flex-wrap items-center gap-2 border-b border-border-strong bg-card-2 px-3 py-2'

const OUTCOME_TONE: Record<MarkOutcome, string> = {
  tested: 'text-success-800',
  refuse: 'text-danger-800',
  unknown: 'text-muted-foreground',
}

/**
 * Bulk Mark Tested (BackOffice spec 4190 stories 40–43, server 4194; oms 959): one note for the
 * selected Planned bonus buys, or — with nothing selected — the ones the last apply saved. Shown only
 * with the tester grant. The server re-validates each row; the answer is a result per row and a batch
 * id, and the list refreshes. There is no bulk Activate.
 */
export default function MarkTestedPanel({
  selected,
  lastSaved,
  list,
  disabled,
  onBusyChange,
  onMarked,
}: {
  selected: readonly BbyBulkListRow[]
  /** The numbers the last apply saved (empty before an apply). */
  lastSaved: readonly string[]
  /** The refreshed list, for the saved rows' new versions. */
  list: readonly BbyBulkListRow[]
  disabled: boolean
  /** Reports a Mark Tested in flight, so the page holds Preview and Apply while it runs. */
  onBusyChange: (busy: boolean) => void
  /** Clears the selection and refetches the list. */
  onMarked: () => Promise<void>
}) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const permissions = usePermissions()
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reading, setReading] = useState<MarkTestedReading | null>(null)

  if (!canMarkBulkTested(permissions)) return null

  const targets = markTestedTargets(selected, lastSaved, list)
  const n = fsi(String(targets.length))
  const reason =
    targets.length === 0
      ? t('markTested.empty')
      : targets.length > BULK_CAP
        ? t('batch.overCap', { cap: fsi(String(BULK_CAP)) })
        : undefined
  const blocked = reason !== undefined || disabled || busy

  const run = async () => {
    const ok = await confirmAction(t('markTested.confirmBody', { count: targets.length, n }), t('markTested.confirmTitle'))
    if (!ok) return
    setBusy(true)
    onBusyChange(true)
    setError(null)
    try {
      const read = readMarkTested(await bbyBulkChangeApi.markTested(markTestedRequest(targets, note)))
      setReading(read)
      // Decided off the reading: a batch refused whole may carry no rows at all (bonusBuys null).
      if (!read.refusedWhole) setNote('')
      await onMarked()
    } catch (err) {
      setError(apiErrorMessage(err, t('markTested.error')))
    } finally {
      setBusy(false)
      onBusyChange(false)
    }
  }

  return (
    <div className="flex flex-col rounded-lg border border-border/60 bg-card" data-testid="bulk-mark-tested">
      <div className={BAR}>
        <span className="font-medium">{t('markTested.title')}</span>
        <span className="text-xs text-muted-foreground">
          {selected.length > 0
            ? t('markTested.fromSelection', { count: targets.length, n })
            : t('markTested.fromApply', { count: targets.length, n })}
        </span>
        <span className="flex-1" />
        <Button
          variant="primary"
          aria-disabled={blocked}
          title={reason}
          data-testid="bulk-mark-tested-run"
          onClick={() => !blocked && run()}
        >
          {t('markTested.button')}
        </Button>
      </div>
      <div className="p-3">
        <Field label={t('markTested.note')}>
          <Textarea
            value={note}
            maxLength={BULK_TEST_NOTE_MAX}
            rows={2}
            placeholder={t('markTested.notePlaceholder')}
            disabled={busy}
            onChange={(e) => setNote(e.target.value)}
            data-testid="bulk-mark-tested-note"
          />
        </Field>
      </div>
      {error && <ErrorBanner className="mx-3 mb-3" message={error} />}
      {reading && <MarkTestedResult reading={reading} />}
    </div>
  )
}

function MarkTestedResult({ reading }: { reading: MarkTestedReading }) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const { counts } = reading
  return (
    <div className="flex flex-col gap-2 border-t border-border/60 px-3 py-2 text-sm" role="status" data-testid="bulk-mark-tested-result">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-semibold">{t('markTested.resultTitle')}</span>
        {reading.batchId && (
          <span className="text-xs text-muted-foreground" data-testid="bulk-mark-tested-batch-id">
            {t('result.batchId')}{' '}
            <span className="font-mono text-foreground">
              <Ltr>{reading.batchId}</Ltr>
            </span>
          </span>
        )}
        {!reading.refusedWhole && (
          <span className="text-xs text-muted-foreground">
            {t('markTested.counts', { tested: fsi(String(counts.tested)), refuse: fsi(String(counts.refuse)) })}
          </span>
        )}
      </div>
      {reading.refusedWhole && <div className="font-medium text-danger-800">{t('markTested.refusedWhole')}</div>}
      <Refusals refusals={reading.batchRefusals} tone="bad" />
      <Refusals refusals={reading.batchWarnings} tone="warn" />
      {reading.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-1 pe-3 text-start font-medium">{t('result.col.number')}</th>
                <th className="py-1 pe-3 text-start font-medium">{t('result.col.outcome')}</th>
                <th className="py-1 text-start font-medium">{t('markTested.col.refusals')}</th>
              </tr>
            </thead>
            <tbody>
              {reading.rows.map((row) => (
                <tr key={row.number} className="border-b border-border/40 align-top" data-outcome={row.outcome}>
                  <td className="py-1.5 pe-3 font-mono">
                    <Ltr>{row.number}</Ltr>
                  </td>
                  <td className={`py-1.5 pe-3 font-medium ${OUTCOME_TONE[row.outcome]}`}>
                    {t(`markTested.outcome.${row.outcome}`)}
                  </td>
                  <td className="py-1.5">
                    <Refusals refusals={row.refusals} tone="bad" />
                    <Refusals refusals={row.warnings} tone="warn" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
