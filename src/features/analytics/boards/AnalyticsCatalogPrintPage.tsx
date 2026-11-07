import { useEffect, useMemo, useState } from 'react'
import { useIsFetching, useQuery } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { formatClock, formatDay, formatValue } from '@/core/charts/format'
import i18n from '@/core/i18n'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import Ltr from '@/core/ui/Ltr'
import { formatPair, formatParts } from '@/core/util/bidi'
import { History } from './CatalogAreaDetail'
import { BothOrNone, ServerText } from './CatalogDetailParts'
import { PlannedStatusBadge } from './CatalogPlannedDetail'
import { catalogPrint, catalogPrintQueries, type CatalogPrint, type PrintArea } from './catalog-print'
import Refused from './Refused'
import { PAPER_PX } from './ReportDocument'
import { renderTicket, setRenderTicket, ticketOf } from './render-ticket'

/** The Catalog leaf the toolbar goes back to. */
const CATALOG_PATH = '/analytics/catalog'

/**
 * The catalog's print page at `/analytics/print/catalog` (ticket 845, BackOffice spec 3437 §G, story 52) — outside the
 * shell, A4. Under a render ticket (`?lang=…&ticket=…`, BO 3444) it is the server's headless Chromium printing
 * `POST Analytics/Catalog/Render`: its ONE read is `Render/Catalog` (`catalogPrintQueries`) — no access probe, no
 * model — and it says it is ready with `data-print-ready`, never opening the print dialog. Opened by a person (no
 * ticket, session-guarded by the route) it reads `Analytics/Catalog` and opens the print dialog.
 *
 * The paper is in the ticket's language (the document direction follows it); every label prints in both languages.
 */
export default function AnalyticsCatalogPrintPage() {
  const { t } = useTranslation('boards')
  const [search] = useSearchParams()
  const ticket = ticketOf(search)
  if (ticket && renderTicket()?.ticket !== ticket) setRenderTicket({ ticket, lang: search.get('lang') === 'ar' ? 'ar' : 'en' })
  const lang = renderTicket()?.lang
  useEffect(() => {
    if (!lang) return
    if (i18n.language !== lang) void i18n.changeLanguage(lang)
    // Direction is a boot fact read from the stored locale (`@/core/theme/direction`), but the renderer is a fresh
    // profile with none: the paper takes the ticket's direction here. Safe live — this page mounts no grid.
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr'
  }, [lang])

  const [query] = catalogPrintQueries()
  const catalog = useQuery({ ...query, staleTime: 60_000 })
  const print = useMemo(() => (catalog.data ? catalogPrint(catalog.data) : null), [catalog.data])

  useEffect(() => {
    const style = document.createElement('style')
    style.textContent = '@page { size: A4; margin: 14mm; } @media print { html, body { background: var(--card) !important; } }'
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  if (catalog.isError) return <Refused err={catalog.error} fallbackKey="catalog.loadFailed" />
  if (!print)
    return (
      <div className="p-8 text-sm text-muted-foreground" role="status">
        {t('catalog.loading')}
      </div>
    )
  return <PrintView print={print} />
}

function PrintView({ print }: { print: CatalogPrint }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  // Ready once nothing is fetching and the paper had a moment to lay out (as the report's print page).
  const ready = useIsFetching() === 0
  const ticketed = renderTicket() !== null
  const [drawn, setDrawn] = useState(false)
  useEffect(() => {
    if (!ready) return
    const timer = window.setTimeout(() => (ticketed ? setDrawn(true) : window.print()), 600)
    return () => window.clearTimeout(timer)
  }, [ready, ticketed])

  return (
    <div
      className="min-h-screen bg-muted/40 py-6 print:bg-card print:py-0"
      data-catalog-print-page={ready ? 'ready' : 'waiting'}
      {...(drawn && ready ? { 'data-print-ready': '' } : {})}
    >
      <div className="mx-auto mb-4 flex justify-end gap-2 print:hidden" style={{ width: PAPER_PX }}>
        <Link to={CATALOG_PATH} className={buttonClass('secondary')} data-catalog-print-back>
          {t('catalog.print.back')}
        </Link>
        <Button onClick={() => window.print()}>
          <Printer className="size-3.5" aria-hidden />
          {t('catalog.print.printAgain')}
        </Button>
      </div>
      {/* A4 at 14 mm margins is ~688 CSS px wide; the paper is exactly that wide on screen too (see ReportDocument). */}
      <article className="mx-auto flex flex-col gap-5 bg-card text-sm ring-8 ring-card print:ring-0" style={{ width: PAPER_PX }} data-analytics-catalog-print>
        <header className="flex flex-col gap-1 border-b border-border pb-3">
          <h1 className="text-xl font-semibold tracking-tight">{t('catalog.print.title')}</h1>
          <p className="text-muted-foreground">{t('catalog.print.subtitle')}</p>
          {print.lineageAvailable && print.imageVersion ? (
            <p className="text-xs text-muted-foreground" data-catalog-image-version>
              <Trans t={t} i18nKey="catalog.imageVersion" components={{ v: <Ltr /> }} values={{ version: print.imageVersion }} />
            </p>
          ) : (
            <p className="text-xs text-muted-foreground" data-catalog-lineage-unavailable>
              {t('catalog.lineageNote')}
            </p>
          )}
          {print.curator && <p className="text-xs text-muted-foreground">{t('catalog.print.curatorNote')}</p>}
        </header>

        <section className="flex flex-col gap-4" data-catalog-print-areas>
          <h2 className="text-base font-semibold tracking-tight">{t('catalog.print.areas')}</h2>
          {print.areas.length === 0 ? <p className="text-muted-foreground">{t('catalog.empty')}</p> : print.areas.map((a) => <AreaBlock key={a.area.key} a={a} lang={lang} />)}
        </section>

        <section className="flex flex-col gap-3 [break-before:page]" data-catalog-print-planned>
          <h2 className="text-base font-semibold tracking-tight">{t('catalog.planned.section')}</h2>
          <p className="text-muted-foreground">{t('catalog.planned.hint')}</p>
          {print.planned.map((g) => (
            <div key={g.status} className="flex flex-col gap-2" data-catalog-print-status={g.status}>
              <h3 className="font-semibold">{t(`catalog.planned.status.${g.status}`)}</h3>
              {g.planned.map(({ planned, sources }) => (
                <div key={planned.key} className="flex flex-col gap-1 rounded-md border border-border/60 p-3 [break-inside:avoid]" data-catalog-print-planned-area={planned.key}>
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="min-w-0 flex-1 font-medium">
                      <BothOrNone says={planned.label} />
                    </span>
                    <PlannedStatusBadge status={planned.status} />
                  </div>
                  {planned.questions.length > 0 && (
                    <ul className="flex list-disc flex-col gap-1 ps-4">
                      {planned.questions.map((q, i) => (
                        <li key={i}>
                          <BothOrNone says={q} />
                        </li>
                      ))}
                    </ul>
                  )}
                  {sources.length > 0 && (
                    <ul className="flex flex-col gap-0.5 text-xs">
                      {sources.map((s) => (
                        <li key={s.key} className="flex flex-wrap gap-2">
                          <Ltr>{s.key}</Ltr>
                          <span className="text-muted-foreground">{t(`catalog.planned.sourceKind.${s.kind}`)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
          ))}
          <h3 className="font-semibold">{t('catalog.planned.node.untappedGroup')}</h3>
          {print.untapped.length === 0 ? (
            <p className="text-muted-foreground">{t('catalog.notGiven')}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {print.untapped.map((u) => (
                <li key={u.key} className="flex flex-col items-start [break-inside:avoid]" data-catalog-print-untapped={u.key}>
                  <Ltr>{formatParts([u.server, u.database, u.table])}</Ltr>
                  <span className="text-xs text-muted-foreground">
                    <ServerText text={u.note} />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </article>
    </div>
  )
}

function AreaBlock({ a, lang }: { a: PrintArea; lang: string }) {
  const { t } = useTranslation('boards')
  const { area, facts } = a
  return (
    <div className="flex flex-col gap-2 rounded-md border border-border/60 p-3 [break-inside:avoid]" data-catalog-print-area={area.key}>
      <div className="flex flex-wrap items-start gap-2">
        <h3 className="min-w-0 flex-1 font-semibold">
          <BothOrNone says={area.label} />
        </h3>
        <span className="text-xs text-muted-foreground">
          <Ltr>{area.key}</Ltr>
        </span>
      </div>
      <BothOrNone says={area.description} />
      <dl className="grid grid-cols-[minmax(7rem,auto)_1fr] gap-x-4 gap-y-1.5">
        <dt className="text-muted-foreground">{t('catalog.fact.availability')}</dt>
        <dd>
          {area.available ? (
            t('catalog.available')
          ) : (
            <span className="flex flex-col">
              <span className="font-medium">{t('catalog.unavailable')}</span>
              <BothOrNone says={area.unavailableReason} />
            </span>
          )}
        </dd>
        <dt className="text-muted-foreground">{t('catalog.area.dataAsOf')}</dt>
        <dd>
          {facts.dataAsOf ? <Ltr>{formatPair(formatDay(facts.dataAsOf.at, lang), formatClock(facts.dataAsOf.at, lang))}</Ltr> : <span className="text-muted-foreground">{t('catalog.area.notKnown')}</span>}
        </dd>
        <dt className="text-muted-foreground">{t('catalog.area.history')}</dt>
        <dd>
          <History history={facts.history} lang={lang} />
        </dd>
        <dt className="text-muted-foreground">{t('catalog.area.refresh')}</dt>
        <dd>
          <BothOrNone says={facts.refresh} />
        </dd>
        <dt className="text-muted-foreground">{t('catalog.area.boundary')}</dt>
        <dd>
          {facts.boundary.length === 0 ? (
            <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
          ) : (
            <ul className="flex list-disc flex-col gap-1 ps-4" data-catalog-boundary>
              {facts.boundary.map((b, i) => (
                <li key={i}>
                  <BothOrNone says={b} />
                </li>
              ))}
            </ul>
          )}
        </dd>
        <dt className="text-muted-foreground">{t('catalog.fact.owner')}</dt>
        <dd>
          <ServerText text={area.owner} />
        </dd>
      </dl>
      <h4 className="mt-1 font-medium">{t('catalog.print.holds')}</h4>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-xs text-muted-foreground">{t('catalog.group.measures')}</p>
          <ul className="flex flex-col gap-1" data-catalog-print-measures>
            {area.measures.map((m) => (
              <li key={m.key}>
                <BothOrNone says={m.label} />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{t('catalog.group.dimensions')}</p>
          <ul className="flex flex-col gap-1" data-catalog-print-dimensions>
            {area.dimensions.map((d) => (
              <li key={d.key}>
                <BothOrNone says={d.label} />
              </li>
            ))}
          </ul>
        </div>
      </div>
      <h4 className="mt-1 font-medium">{t('catalog.group.marts')}</h4>
      {a.marts.length === 0 && a.missingMarts.length === 0 ? (
        <p className="text-muted-foreground">{t('catalog.noMarts')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5" data-catalog-print-marts>
          {a.marts.map((m) => (
            <li key={m.key} className="flex flex-col items-start">
              <span className="flex flex-wrap gap-2">
                <Ltr>{m.key}</Ltr>
                <span className="text-muted-foreground">{t(`catalog.martKind.${m.kind}`)}</span>
              </span>
              {m.grain && (
                <span className="text-xs">
                  <span className="text-muted-foreground">{t('catalog.print.grain')}</span> <ServerText text={m.grain} />
                </span>
              )}
              {m.columns !== null && (
                <span className="flex flex-wrap gap-x-4 text-xs text-muted-foreground" data-catalog-print-curator>
                  <span>
                    <span className="text-muted-foreground">{t('catalog.raw.rows')}</span> {m.rows === null ? t('catalog.raw.notStored') : <Ltr>{formatValue(m.rows, 'count', lang)}</Ltr>}
                  </span>
                  {m.sizeMb !== null && (
                    <span>
                      <span className="text-muted-foreground">{t('catalog.raw.size')}</span> <Trans t={t} i18nKey="catalog.raw.sizeValue" values={{ size: formatValue(m.sizeMb, 'count', lang) }} components={{ n: <Ltr /> }} />
                    </span>
                  )}
                  <span>
                    <span className="text-muted-foreground">{t('catalog.raw.hidden')}</span> <Ltr>{m.hidden ?? 0}</Ltr>
                  </span>
                </span>
              )}
            </li>
          ))}
          {a.missingMarts.map((k) => (
            <li key={k} className="flex flex-wrap gap-2">
              <Ltr>{k}</Ltr>
              <span className="text-muted-foreground">{t('catalog.print.missingMart')}</span>
            </li>
          ))}
        </ul>
      )}
      <h4 className="mt-1 font-medium">{t('catalog.print.sources')}</h4>
      {a.sources.length === 0 ? (
        <p className="text-muted-foreground">{t('catalog.noSources')}</p>
      ) : (
        <ul className="flex flex-col gap-1" data-catalog-print-sources>
          {a.sources.map((s) => (
            <li key={s.key} className="flex flex-col items-start">
              {s.source ? (
                <>
                  <Ltr>{formatParts([s.source.server, s.source.database, s.source.table])}</Ltr>
                  {s.source.description && (
                    <span className="text-xs text-muted-foreground">
                      <ServerText text={s.source.description} />
                    </span>
                  )}
                </>
              ) : (
                <span className="flex flex-wrap gap-2">
                  <Ltr>{s.key}</Ltr>
                  <span className="text-muted-foreground">{t('catalog.print.unresolved')}</span>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
