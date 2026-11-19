import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import type { ItemListPreview } from '@/core/models/item-list'
import Ltr from '@/core/ui/Ltr'
import { formatTimeOfDay } from '@/core/util/date-format'
import { MembersGrid, PeriodsGrid } from './ItemListGrids'
import { problemGroups } from './preview'

/**
 * The preview (spec 4057 story 5; BO 4058's `AnalyticsItemListPreview`): the file's counts, its unknown values and its
 * problems — duplicates, bad dates, overlapping periods, refused rows — and notices, each with its row numbers, then the
 * list as it would be kept (its members and periods). Nothing is kept yet.
 */
export default function PreviewPanel({ preview }: { preview: ItemListPreview }) {
  const { t } = useTranslation('item-lists')
  const groups = problemGroups(preview)
  // The problems are what refuse the save; the unknown values (kept, story 6) and the notices are listed but not counted.
  const problemCount = preview.problems.length
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-item-list-preview="">
      <header className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">{t('preview.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('preview.lede')}</p>
      </header>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4" data-item-list-counts="">
        <Count k="file" label={t('preview.file')}>
          <bdi>{preview.fileName}</bdi>
        </Count>
        <Count k="rows" label={t('preview.rows')}>
          <Ltr>{preview.rowCount}</Ltr>
        </Count>
        <Count k="matched" label={t('preview.matched')}>
          <Ltr>{preview.matchedRows}</Ltr>
        </Count>
        <Count k="problems" label={t('preview.problems')}>
          <Ltr>{problemCount}</Ltr>
        </Count>
      </dl>

      {preview.expiresAt && (
        <p className="text-xs text-muted-foreground" data-item-list-kept-until="">
          <Trans t={t} i18nKey="preview.keptUntil" values={{ at: formatTimeOfDay(preview.expiresAt) }} components={{ at: <Ltr /> }} />
        </p>
      )}

      {groups.length === 0 ? (
        <p className="inline-flex items-center gap-1.5 text-sm text-success-800" data-item-list-clean="">
          <CheckCircle2 className="size-4" aria-hidden />
          {t('preview.clean')}
        </p>
      ) : (
        <div className="flex flex-col gap-3" data-item-list-problems={problemCount}>
          {groups.map((g) => (
            <section key={g.kind} className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 p-3" data-item-list-problem-kind={g.kind}>
              <h3 className="inline-flex items-center gap-1.5 text-sm font-semibold text-attention-800">
                <AlertTriangle className="size-4" aria-hidden />
                {t(`preview.kinds.${g.kind}`)}
                <span className="text-xs font-normal">
                  (<Ltr>{g.problems.length}</Ltr>)
                </span>
              </h3>
              <p className="text-xs text-muted-foreground">{t(`preview.kindHints.${g.kind}`)}</p>
              <ul className="flex flex-col gap-1 text-sm">
                {g.problems.map((p, i) => (
                  <li key={i} className="flex flex-wrap items-baseline gap-x-2 gap-y-1" data-item-list-problem={g.kind} data-rows={p.rows.join(' ')}>
                    <span className="text-xs text-muted-foreground">{t(p.rows.length > 1 ? 'preview.rowsOf' : 'preview.row')}</span>
                    {p.rows.map((r) => (
                      <span key={r} className="rounded bg-card px-1.5 font-mono text-xs" data-item-list-row={r}>
                        <Ltr>{r}</Ltr>
                      </span>
                    ))}
                    {p.level && <span className="text-xs text-muted-foreground">{t(`level.${p.level}`, { defaultValue: p.level })}</span>}
                    {p.value && (
                      <span className="font-mono" data-item-list-problem-value="">
                        <bdi>{p.value}</bdi>
                      </span>
                    )}
                    {p.message && (
                      <span className="text-xs" data-item-list-problem-message="">
                        <bdi>{p.message}</bdi>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {preview.members.length === 0 ? (
        <p role="alert" className="rounded-md border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" data-item-list-none-matched="">
          {t('preview.noneMatched')}
        </p>
      ) : (
        <>
          <div className="flex flex-col gap-1" data-item-list-preview-members={preview.members.length}>
            <h3 className="text-sm font-semibold">{t('list.members')}</h3>
            <MembersGrid members={preview.members} periods={preview.periods} />
          </div>
          {preview.periods.length > 0 && (
            <div className="flex flex-col gap-1" data-item-list-preview-periods={preview.periods.length}>
              <h3 className="text-sm font-semibold">{t('list.periods')}</h3>
              <PeriodsGrid members={preview.members} periods={preview.periods} />
            </div>
          )}
        </>
      )}
    </section>
  )
}

function Count({ k, label, children }: { k: string; label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md bg-muted/50 p-2" data-item-list-count={k}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-semibold">{children}</dd>
    </div>
  )
}
