import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, CheckCircle2, ListChecks, Loader2, XCircle } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { knownField, problemWords, type CheckSummary } from './check-summary'
import { partLabel } from './part-label'
import type { EditChangeSummary } from './edit-changes'
import type { HungerStationPromotionPartChange } from '@/core/models/hungerstation'
import type { Severity } from '@/core/ui/severity'

/** How many refused rows the panel lists by name; the rest are counted (the grid marks every one). */
const ROWS_LISTED = 20

/**
 * The editor's **Check** panel (ticket 667, BackOffice 3212): run on demand (and by Send first) on
 * the SAVED promotion. Refusals per header field and per row, in words; they hold Send back. Price
 * warnings, in the attention colour, name the stores where HungerStation will refuse the material;
 * they never hold Send back.
 *
 * A same-item bundle (668) also shows its **part preview**: one row per HungerStation promotion
 * part the SERVER will send (BackOffice 3213's split), its combination in words, its SKU count and
 * the name it will carry on HungerStation. The page never computes the parts.
 *
 * On a SENT promotion (670, `edit`) the panel checks the edit as typed (it rides as the Check body,
 * nothing is written) and says what changes on HungerStation, per part, from the SERVER's recompute
 * (BackOffice 3215): a new part, a part re-sent, a part switched off because it is left empty, and
 * each material that moves from one part to another, leaves, or joins.
 */
export default function CheckPanel({
  summary,
  checking,
  error,
  canCheck,
  onCheck,
  storeName,
  showParts = false,
  edit = false,
}: {
  summary: CheckSummary | null
  checking: boolean
  error: unknown
  /** The promotion is saved as it reads. */
  canCheck: boolean
  onCheck: () => void
  storeName: (storeCode: string) => string | null
  /** 668: a same-item bundle — show the parts Check answered. */
  showParts?: boolean
  /** 670: an in-place edit of a sent promotion: check the edit as typed, show what changes. */
  edit?: boolean
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
        <Button variant="outlined" disabled={!canCheck || checking} title={canCheck ? undefined : t(edit ? 'check.editNeedsChange' : 'check.needsSave')} onClick={onCheck} data-check-run="">
          {checking && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
          {checking ? t('check.running') : t('check.run')}
        </Button>
      </div>

      {error ? (
        <ErrorBanner className="p-2.5" title={t('check.failed')} message={apiErrorMessage(error, t('results.failed'))} />
      ) : !summary ? (
        <p className="text-xs text-muted-foreground" data-check-intro="">
          {edit ? (canCheck ? t('check.editIntro') : t('check.editNeedsChange')) : canCheck ? t('check.intro') : t('check.needsSave')}
        </p>
      ) : (
        <>
          {summary.refusals === 0 ? (
            <p className="flex items-center gap-1.5 text-xs font-medium text-success-800" data-check-clean="">
              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
              {t(edit ? 'check.editClean' : 'check.clean')}
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

          {edit && summary.changes && <EditChanges changes={summary.changes} />}

          {showParts && !summary.changes && summary.parts.length > 0 && (
            <div className="flex flex-col gap-1" data-check-parts={summary.parts.length}>
              <h4 className="text-xs font-medium text-muted-foreground">{t('check.partsTitle')}</h4>
              <p className="text-xs" data-check-parts-count="">
                <Trans t={t} i18nKey="check.partsCount" count={summary.parts.length} values={{ n: figure(summary.parts.length) }} components={{ n: <Ltr /> }} />
              </p>
              <p className="text-xs text-muted-foreground">{t('check.partsHint')}</p>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border/60 text-muted-foreground">
                    <th className="px-2 py-1 text-start font-medium">{t('check.partColumns.combination')}</th>
                    <th className="px-2 py-1 text-end font-medium">{t('check.partColumns.skus')}</th>
                    <th className="px-2 py-1 text-start font-medium">{t('check.partColumns.name')}</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.parts.map((part, i) => (
                    <tr key={`${part.name}-${i}`} className="border-b border-border/40" data-check-part={i}>
                      <td className="px-2 py-1" data-check-part-combination="">
                        {partLabel(t, part)}
                      </td>
                      <td className="px-2 py-1 text-end tabular-nums" data-check-part-skus={part.skuCount}>
                        <Ltr>{figure(part.skuCount)}</Ltr>
                      </td>
                      <td className="px-2 py-1" data-check-part-name="">
                        <bdi>{part.name}</bdi>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

const CHANGE_SEV: Record<HungerStationPromotionPartChange['change'], Severity> = { new: 'go', updated: 'ok', switchedOff: 'warn', unchanged: 'mute' }

/** 670: what an in-place edit changes on HungerStation, as the server recomputed the parts. Each
 *  part (new first, then switched off, re-sent, unchanged), then each material that moves, leaves or
 *  joins (the first 20 of each, the rest counted). */
function EditChanges({ changes }: { changes: EditChangeSummary }) {
  const { t } = useTranslation('hungerstation-promotions')
  const parts = [...changes.newParts, ...changes.switchedOff, ...changes.updated]
  const more = (n: number) =>
    n > ROWS_LISTED && (
      <li className="text-muted-foreground" data-check-changes-more={n - ROWS_LISTED}>
        <Trans t={t} i18nKey="check.changes.more" count={n - ROWS_LISTED} values={{ n: figure(n - ROWS_LISTED) }} components={{ n: <Ltr /> }} />
      </li>
    )
  return (
    <div className="flex flex-col gap-1.5" data-check-changes={changes.calls}>
      <h4 className="text-xs font-medium text-muted-foreground">{t('check.changes.title')}</h4>
      {!changes.any ? (
        <p className="text-xs" data-check-changes-none="">
          {t('check.changes.none')}
        </p>
      ) : (
        <>
          <p className="text-xs" data-check-changes-calls="">
            <Trans t={t} i18nKey="check.changes.calls" count={changes.calls} values={{ n: figure(changes.calls) }} components={{ n: <Ltr /> }} />
          </p>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/60 text-muted-foreground">
                <th className="px-2 py-1 text-start font-medium">{t('check.changes.columns.change')}</th>
                <th className="px-2 py-1 text-start font-medium">{t('check.changes.columns.name')}</th>
                <th className="px-2 py-1 text-start font-medium">{t('check.changes.columns.combination')}</th>
                <th className="px-2 py-1 text-end font-medium">{t('check.changes.columns.skus')}</th>
                <th className="px-2 py-1 text-end font-medium">{t('check.changes.columns.leaving')}</th>
                <th className="px-2 py-1 text-end font-medium">{t('check.changes.columns.joining')}</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((part, i) => (
                <tr key={`${part.partId ?? 'new'}-${i}`} className="border-b border-border/40" data-check-change={part.change} data-check-change-part={part.partId ?? 'new'}>
                  <td className="px-2 py-1">
                    <StatusBadge sev={CHANGE_SEV[part.change]}>{t(`check.changes.kinds.${part.change}`)}</StatusBadge>
                  </td>
                  <td className="px-2 py-1" data-check-change-name="">
                    <bdi>{part.name}</bdi>
                  </td>
                  <td className="px-2 py-1" data-check-change-combination="">
                    {part.buyQuantity !== null ? partLabel(t, part) : t('check.changes.allItems')}
                  </td>
                  <td className="px-2 py-1 text-end tabular-nums" data-check-change-skus={part.skuCount}>
                    <Ltr>{figure(part.skuCount)}</Ltr>
                  </td>
                  <td className="px-2 py-1 text-end tabular-nums" data-check-change-leaving={part.leaving.length}>
                    <Ltr>{figure(part.leaving.length)}</Ltr>
                  </td>
                  <td className="px-2 py-1 text-end tabular-nums" data-check-change-joining={part.joining.length}>
                    <Ltr>{figure(part.joining.length)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {changes.unchanged > 0 && (
            <p className="text-xs text-muted-foreground" data-check-changes-unchanged={changes.unchanged}>
              <Trans t={t} i18nKey="check.changes.unchanged" count={changes.unchanged} values={{ n: figure(changes.unchanged) }} components={{ n: <Ltr /> }} />
            </p>
          )}
          {changes.switchedOff.length > 0 && (
            <p className="text-xs text-attention-800" data-check-changes-off-hint="">
              {t('check.changes.switchedOffHint')}
            </p>
          )}
          {(changes.moved.length > 0 || changes.removed.length > 0 || changes.added.length > 0) && (
            <ul className="flex flex-col gap-0.5 text-xs">
              {changes.moved.slice(0, ROWS_LISTED).map((x) => (
                <li key={`m-${x.materialNumber}`} data-check-moved={x.materialNumber}>
                  <Trans t={t} i18nKey="check.changes.moved" values={{ material: x.materialNumber, from: x.from, to: x.to }} components={{ m: <Ltr />, from: <bdi />, to: <bdi /> }} />
                </li>
              ))}
              {more(changes.moved.length)}
              {changes.removed.slice(0, ROWS_LISTED).map((x) => (
                <li key={`r-${x.materialNumber}`} data-check-left={x.materialNumber}>
                  <Trans t={t} i18nKey="check.changes.left" values={{ material: x.materialNumber, from: x.from }} components={{ m: <Ltr />, from: <bdi /> }} />
                </li>
              ))}
              {more(changes.removed.length)}
              {changes.added.slice(0, ROWS_LISTED).map((x) => (
                <li key={`a-${x.materialNumber}`} data-check-joined={x.materialNumber}>
                  <Trans t={t} i18nKey="check.changes.joined" values={{ material: x.materialNumber, to: x.to }} components={{ m: <Ltr />, to: <bdi /> }} />
                </li>
              ))}
              {more(changes.added.length)}
            </ul>
          )}
        </>
      )}
    </div>
  )
}
