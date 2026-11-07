import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import TableChart from '@/core/charts/TableChart'
import type { AnalyticsCatalogArea } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import MultiSelect from '@/core/ui/MultiSelect'
import Select from '@/core/ui/Select'
import { fsi } from '@/core/util/bidi'
import { analyticsApi } from './api'
import { analyticsPreviewKey, droppedNotes, previewChoice, previewDimensions, previewRefusal, previewRequest, previewTable, withPreviewPeriod } from './catalog-preview'
import { PERIODS, periodNameKey } from './periods'
import { refusalWords } from './wire'

/**
 * The catalog preview (ticket 843, BackOffice spec 3437 §D, stories 35–38): up to 200 rows of an area by day, newest
 * first, through `POST Analytics/Catalog/Preview` — the query door's caps, timeout and audit. Any viewer.
 *
 * The period picker and the column chooser (category dimensions, measures) change the request, and so its query key:
 * the preview asks again. A measure a chosen dimension refuses is listed under the grid; an unavailable area shows
 * its reason, never an empty grid. Drawn in `@/core/charts/TableChart` (the grid base, isolated headers, the charts'
 * formats).
 */
export default function CatalogPreview({ area, measure }: { area: AnalyticsCatalogArea; measure?: string }) {
  const { t, i18n } = useTranslation('boards')
  const lang = i18n.language
  const [choice, setChoice] = useState(() => previewChoice(measure))
  const body = useMemo(() => previewRequest(area, choice), [area, choice])
  const q = useQuery({ queryKey: analyticsPreviewKey(body), queryFn: () => analyticsApi.catalogPreview(body), retry: false, staleTime: 60_000 })

  const name = (l: { en: string; ar: string }, key: string) => saysIn(l, lang) || key
  const categories = previewDimensions(area)
  const table = q.data ? previewTable(q.data, area, lang) : null
  const notes = q.data ? droppedNotes(q.data, area, lang) : []

  return (
    <section className="flex min-w-0 flex-col gap-3 border-t border-border/60 pt-4" aria-label={t('catalog.preview.title')} data-catalog-preview>
      <h3 className="text-sm font-semibold">{t('catalog.preview.title')}</h3>
      <p className="text-xs text-muted-foreground">{t('catalog.preview.hint')}</p>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Field label={t('catalog.preview.period')}>
          <Select value={choice.period} onChange={(e) => setChoice((c) => withPreviewPeriod(c, e.target.value))} data-catalog-preview-period>
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {t(periodNameKey(p))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('catalog.preview.dimensions')} hint={t('catalog.preview.dimensionsHint')}>
          <MultiSelect
            label={t('catalog.preview.dimensions')}
            value={choice.dimensions}
            onChange={(dimensions) => setChoice((c) => ({ ...c, dimensions }))}
            options={categories.map((d) => ({ value: d.key, text: name(d.label, d.key) }))}
            data-testid="catalog-preview-dimensions"
          />
        </Field>
        <Field label={t('catalog.preview.measures')} hint={t('catalog.preview.measuresHint')}>
          <MultiSelect
            label={t('catalog.preview.measures')}
            value={choice.measures}
            onChange={(measures) => setChoice((c) => ({ ...c, measures }))}
            options={area.measures.map((m) => ({ value: m.key, text: name(m.label, m.key) }))}
            data-testid="catalog-preview-measures"
          />
        </Field>
      </div>

      {q.isPending ? (
        <p className="text-sm text-muted-foreground" data-catalog-preview-state="loading">
          {t('catalog.preview.loading')}
        </p>
      ) : q.isError ? (
        <PreviewRefused area={area} err={q.error} onRetry={() => void q.refetch()} />
      ) : (
        <>
          {notes.length > 0 && (
            <div className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm" data-catalog-preview-dropped>
              <p className="font-medium">{t('catalog.preview.dropped.title')}</p>
              <ul className="mt-1 flex flex-col gap-0.5">
                {notes.map((n) => (
                  <li key={n.measure} data-catalog-preview-dropped-measure={n.measure}>
                    <Trans
                      t={t}
                      i18nKey="catalog.preview.dropped.one"
                      values={{ measure: n.label, because: n.because }}
                      components={{ m: <bdi />, d: <bdi /> }}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {table && table.rows.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-catalog-preview-state="empty">
              {t('catalog.preview.empty')}
            </p>
          ) : (
            table && (
              <>
                <p className="text-xs text-muted-foreground" data-catalog-preview-count>
                  <Trans t={t} i18nKey="catalog.preview.rows" values={{ n: table.rows.length }} components={{ n: <Ltr /> }} />
                </p>
                <TableChart
                  columns={table.columns}
                  rows={table.rows}
                  sort={null}
                  locale={lang}
                  ariaLabel={t('catalog.preview.gridLabel', { area: fsi(name(area.label, area.key)) })}
                />
              </>
            )
          )}
        </>
      )}
    </section>
  )
}

function PreviewRefused({ area, err, onRetry }: { area: AnalyticsCatalogArea; err: unknown; onRetry: () => void }) {
  const { t, i18n } = useTranslation('boards')
  const lang = i18n.language
  const r = previewRefusal(err, area)
  const words =
    r.kind === 'area'
      ? (r.reason && saysIn(r.reason, lang)) || r.message || t('catalog.preview.refusal.areaUnavailable')
      : refusalWords(r, t) || t('catalog.preview.loadFailed')
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm" role="alert" data-catalog-preview-state="refused">
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="font-medium">{r.kind === 'area' ? t('catalog.preview.refusal.areaUnavailable') : t('catalog.preview.loadFailed')}</span>
        <bdi>{words}</bdi>
      </div>
      {r.kind !== 'area' && (
        <Button variant="outlined" onClick={onRetry} data-catalog-preview-retry>
          {t('catalog.preview.retry')}
        </Button>
      )}
    </div>
  )
}
