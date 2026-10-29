import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, XCircle } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatPair } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { knownField, problemWords, type CheckSummary } from './check-summary'

/** How many refused rows the panel lists by name; the rest are counted (the grid marks every one). */
const ROWS_LISTED = 20

/**
 * The editor's **Check** panel (ticket 667, BackOffice 3212): run on demand (and by Send first) on
 * the SAVED promotion. Refusals per header field and per row, in words; they hold Send back. Price
 * warnings, in the attention colour, name the stores where HungerStation will refuse the material;
 * they never hold Send back.
 */
export default function CheckPanel({
  summary,
  checking,
  error,
  canCheck,
  onCheck,
  storeName,
}: {
  summary: CheckSummary | null
  checking: boolean
  error: unknown
  /** The promotion is saved as it reads. */
  canCheck: boolean
  onCheck: () => void
  storeName: (storeCode: string) => string | null
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const refused = summary ? [...summary.rows].filter(([, r]) => r.refusals.length > 0) : []
  const warned = summary ? [...summary.rows].filter(([, r]) => r.warningStores.length > 0) : []

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border/60 p-3" data-check-panel={summary ? (summary.blocksSend ? 'refused' : 'clean') : 'none'}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-xs font-semibold tracking-tight">
          <ListChecks className="h-3.5 w-3.5" aria-hidden />
          {t('check.title')}
        </h3>
        <Button variant="outlined" disabled={!canCheck || checking} title={canCheck ? undefined : t('check.needsSave')} onClick={onCheck} data-check-run="">
          {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {checking ? t('check.running') : t('check.run')}
        </Button>
      </div>

      {error ? (
        <ErrorBanner className="p-2.5" title={t('check.failed')} message={apiErrorMessage(error, t('results.failed'))} />
      ) : !summary ? (
        <p className="text-xs text-muted-foreground" data-check-intro="">
          {canCheck ? t('check.intro') : t('check.needsSave')}
        </p>
      ) : (
        <>
          {summary.refusals === 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success-800" data-check-clean="">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {t('check.clean')}
            </p>
          ) : (
            <p role="alert" className="flex items-center gap-1.5 text-xs font-medium text-danger-800" data-check-refusals={summary.refusals}>
              <XCircle className="h-3.5 w-3.5" aria-hidden />
              <Trans t={t} i18nKey="check.refusals" count={summary.refusals} values={{ n: figure(summary.refusals) }} components={{ n: <Ltr /> }} />
            </p>
          )}
          {summary.warnings > 0 && (
            <p className="flex items-center gap-1.5 text-xs font-medium text-attention-800" data-check-warnings={summary.warnings}>
              <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
              <Trans t={t} i18nKey="check.warnings" count={summary.warnings} values={{ n: figure(summary.warnings) }} components={{ n: <Ltr /> }} />
            </p>
          )}

          {summary.header.size > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-medium text-muted-foreground">{t('check.headerTitle')}</h4>
              <ul className="flex flex-col gap-0.5 text-xs">
                {[...summary.header].flatMap(([field, problems]) =>
                  problems.map((p, i) => (
                    <li key={`${field}-${i}`} className="text-danger-800" data-check-header={field} data-check-code={p.code}>
                      <span className="me-2 font-medium">{knownField(field) ? t(`check.fields.${field}`) : <Ltr>{field}</Ltr>}</span>
                      <bdi>{problemWords(t, p)}</bdi>
                    </li>
                  )),
                )}
              </ul>
            </div>
          )}

          {refused.length > 0 && (
            <div className="flex flex-col gap-1">
              <h4 className="text-xs font-medium text-muted-foreground">{t('check.rowsTitle')}</h4>
              <p className="text-xs text-danger-800" data-editor-rows-refused={summary.refusedRows}>
                <Trans t={t} i18nKey="check.rowsRefused" count={summary.refusedRows} values={{ n: figure(summary.refusedRows) }} components={{ n: <Ltr /> }} />
              </p>
              <ul className="flex flex-col gap-0.5 text-xs">
                {refused.slice(0, ROWS_LISTED).flatMap(([material, r]) =>
                  r.refusals.map((p, i) => (
                    <li key={`${material}-${i}`} className="flex gap-2 text-danger-800" data-check-row={material} data-check-code={p.code}>
                      <span className="font-mono font-medium">
                        <Ltr>{material}</Ltr>
                      </span>
                      <bdi>{problemWords(t, p)}</bdi>
                    </li>
                  )),
                )}
              </ul>
              {refused.length > ROWS_LISTED && (
                <p className="text-xs text-muted-foreground" data-check-rows-more={refused.length - ROWS_LISTED}>
                  <Trans t={t} i18nKey="check.rowsMore" count={refused.length - ROWS_LISTED} values={{ n: figure(refused.length - ROWS_LISTED) }} components={{ n: <Ltr /> }} />
                </p>
              )}
            </div>
          )}

          {warned.length > 0 && (
            <div className="flex flex-col gap-1 rounded-md bg-attention-050 p-2 text-attention-800" data-check-warnings-list="">
              <h4 className="text-xs font-medium">{t('check.warningsTitle')}</h4>
              <p className="text-xs">{t('check.warningHint')}</p>
              <ul className="flex flex-col gap-1.5 text-xs">
                {warned.map(([material, r]) => (
                  <li key={material} className="flex flex-col gap-0.5" data-check-warning={material}>
                    <span>
                      <span className="me-2 font-mono font-medium">
                        <Ltr>{material}</Ltr>
                      </span>
                      {t('check.warning')}
                    </span>
                    <span className="flex flex-wrap gap-1.5">
                      {r.warningStores.map((code) => {
                        const name = storeName(code)
                        return (
                          <span key={code} className="rounded-full bg-card px-2 py-0.5" data-check-warning-store={code}>
                            {name ? <Ltr>{formatPair(code, name)}</Ltr> : <Ltr>{code}</Ltr>}
                          </span>
                        )
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </section>
  )
}
