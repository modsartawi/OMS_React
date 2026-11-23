import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { BbyRefusal } from '@/core/models/bonus-buy-maintenance'
import type { BulkResultReading, FieldChange, RowOutcome, RuleValue } from './result'

/**
 * The preview (a dry run) or the apply's report (spec 4190 stories 25–27, 31): each bonus buy's
 * outcome, the fields that change with their old and new values in two columns (never glued into one
 * string, so they read the right way under RTL), and every refusal in English and Arabic.
 */
export default function ResultPanel({ reading }: { reading: BulkResultReading }) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const { counts } = reading
  return (
    <div
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card px-3 py-2 text-sm"
      role="status"
      data-testid="bulk-result"
      data-dry-run={reading.dryRun}
    >
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <span className="font-semibold">{reading.dryRun ? t('result.previewTitle') : t('result.appliedTitle')}</span>
        {reading.batchId && (
          <span className="text-xs text-muted-foreground" data-testid="bulk-batch-id">
            {t('result.batchId')}{' '}
            <span className="font-mono text-foreground">
              <Ltr>{reading.batchId}</Ltr>
            </span>
          </span>
        )}
        {!reading.refusedWhole && (
          <span className="text-xs text-muted-foreground">
            {t(reading.dryRun ? 'result.countsPreview' : 'result.countsApplied', {
              save: fsi(String(counts.save)),
              skip: fsi(String(counts.skip)),
              refuse: fsi(String(counts.refuse)),
            })}
          </span>
        )}
      </div>

      {reading.refusedWhole && <div className="font-medium text-danger-800">{t('result.refusedWhole')}</div>}
      <Refusals refusals={reading.batchRefusals} tone="bad" />
      <Refusals refusals={reading.batchWarnings} tone="warn" />

      {reading.rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className="py-1 pe-3 text-start font-medium">{t('result.col.number')}</th>
                <th className="py-1 pe-3 text-start font-medium">{t('result.col.outcome')}</th>
                <th className="py-1 text-start font-medium">{t('result.col.detail')}</th>
              </tr>
            </thead>
            <tbody>
              {reading.rows.map((row) => (
                <tr key={row.number} className="border-b border-border/40 align-top" data-outcome={row.outcome}>
                  <td className="py-1.5 pe-3 font-mono">
                    <Ltr>{row.number}</Ltr>
                  </td>
                  <td className="py-1.5 pe-3">
                    <Outcome outcome={row.outcome} dryRun={reading.dryRun} />
                  </td>
                  <td className="py-1.5">
                    {row.changes.length > 0 && <Changes changes={row.changes} />}
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

const OUTCOME_TONE: Record<RowOutcome, string> = {
  save: 'text-success-800',
  skip: 'text-muted-foreground',
  refuse: 'text-danger-800',
  unknown: 'text-muted-foreground',
}

function Outcome({ outcome, dryRun }: { outcome: RowOutcome; dryRun: boolean }) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  const key = outcome === 'save' && dryRun ? 'wouldSave' : outcome
  return <span className={`font-medium ${OUTCOME_TONE[outcome]}`}>{t(`result.outcome.${key}`)}</span>
}

function Changes({ changes }: { changes: FieldChange[] }) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  return (
    <table className="mb-1">
      <thead className="text-muted-foreground">
        <tr>
          <th className="pe-3 text-start font-normal">{t('result.col.field')}</th>
          <th className="pe-3 text-start font-normal">{t('result.col.before')}</th>
          <th className="text-start font-normal">{t('result.col.after')}</th>
        </tr>
      </thead>
      <tbody>
        {changes.map((c) => (
          <tr key={c.field} data-field={c.field}>
            <td className="pe-3">{t(`field.${c.field}`)}</td>
            <td className="pe-3">
              <Value value={c.before} />
            </td>
            <td>
              <Value value={c.after} />
              {(c.added?.length || c.removed?.length) ? (
                <div className="text-muted-foreground">
                  {c.added && c.added.length > 0 && (
                    <div>
                      {t('result.added')}{' '}
                      <span className="font-mono">
                        <Ltr>{c.added.join(',')}</Ltr>
                      </span>
                    </div>
                  )}
                  {c.removed && c.removed.length > 0 && (
                    <div>
                      {t('result.removed')}{' '}
                      <span className="font-mono">
                        <Ltr>{c.removed.join(',')}</Ltr>
                      </span>
                    </div>
                  )}
                </div>
              ) : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function Value({ value }: { value: RuleValue }) {
  const { t } = useTranslation('bonus-buy-bulk-change')
  if (typeof value === 'boolean') return <>{t(value ? 'value.yes' : 'value.no')}</>
  if (value === '') return <span className="text-muted-foreground">{t('value.empty')}</span>
  return (
    <span className="font-mono break-all">
      <Ltr>{String(value)}</Ltr>
    </span>
  )
}

function Refusals({ refusals, tone }: { refusals: BbyRefusal[]; tone: 'bad' | 'warn' }) {
  if (refusals.length === 0) return null
  return (
    <ul className={`flex flex-col gap-1 ${tone === 'bad' ? 'text-danger-800' : 'text-muted-foreground'}`}>
      {refusals.map((r, i) => (
        <li key={i}>
          <span className="font-mono">
            <Ltr>{r.code}</Ltr>
          </span>{' '}
          <bdi>{r.english}</bdi>
          {r.arabic && (
            <div lang="ar">
              <bdi dir="rtl">{r.arabic}</bdi>
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}
