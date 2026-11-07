import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { formatClock, formatDay } from '@/core/charts/format'
import i18n from '@/core/i18n'
import type { AnalyticsCatalogArea } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { useCatalogActions } from './CatalogActions'
import { areaFacts, type AreaFacts } from './catalog-area'
import { BothOrNone, DetailShell, Fact, ServerText } from './CatalogDetailParts'

/**
 * An area node's detail (ticket 841): its name, description, owner, availability with the reason, and how many
 * members and marts it holds. 842 (spec 3437 stories 22–26): data as of, history start, refresh, the area boundary,
 * the copilot / designer badges, the used-by counts — each linking to the library narrowed to the area — and who
 * may read it; the facts come from `./catalog-area` (pure, shared with 845's print). 843 puts its author actions in
 * `actions`.
 */
export default function CatalogAreaDetail({ area }: { area: AnalyticsCatalogArea }) {
  const { t } = useTranslation('boards')
  const { actions, below } = useCatalogActions(area)
  const lang = i18n.language
  const facts = areaFacts(area)
  return (
    <DetailShell kind={t('catalog.kind.area')} title={area.label} machineKey={area.key} actions={actions} below={below} data="area">
      <Fact label={t('catalog.fact.description')}>
        <BothOrNone says={area.description} />
      </Fact>
      <Fact label={t('catalog.fact.owner')}>
        <ServerText text={area.owner} />
      </Fact>
      <Fact label={t('catalog.fact.availability')} data="availability">
        {area.available ? (
          t('catalog.available')
        ) : (
          <span className="flex flex-col gap-1">
            <span className="font-medium">{t('catalog.unavailable')}</span>
            <BothOrNone says={area.unavailableReason} />
          </span>
        )}
      </Fact>
      <Fact label={t('catalog.area.dataAsOf')} data="data-as-of">
        {facts.dataAsOf ? (
          <Ltr>{formatPair(formatDay(facts.dataAsOf.at, lang), formatClock(facts.dataAsOf.at, lang))}</Ltr>
        ) : (
          <span className="text-muted-foreground">{t('catalog.area.notKnown')}</span>
        )}
      </Fact>
      <Fact label={t('catalog.area.history')} data="history">
        <History history={facts.history} lang={lang} />
      </Fact>
      <Fact label={t('catalog.area.refresh')} data="refresh">
        <BothOrNone says={facts.refresh} />
      </Fact>
      <Fact label={t('catalog.area.boundary')} data="boundary">
        {facts.boundary.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 ps-4" data-catalog-boundary>
            {facts.boundary.map((b, i) => (
              <li key={i}>
                <BothOrNone says={b} />
              </li>
            ))}
          </ul>
        )}
      </Fact>
      <Fact label={t('catalog.area.readBy')} data="read-by">
        {facts.readers.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.area.readByNone')}</span>
        ) : (
          <span className="flex flex-wrap gap-1.5">
            {facts.readers.map((r) => (
              <span key={r} data-catalog-reader={r}>
                <StatusBadge sev="go">{t(`catalog.area.reader.${r}`)}</StatusBadge>
              </span>
            ))}
          </span>
        )}
      </Fact>
      <Fact label={t('catalog.area.usedBy')} data="used-by">
        <UsedBy usedBy={facts.usedBy} />
      </Fact>
      <Fact label={t('catalog.area.whoMayRead')} data="who-may-read">
        {facts.grant ? (
          <Trans t={t} i18nKey="catalog.area.grant" values={{ grant: facts.grant }} components={{ g: <Ltr /> }} />
        ) : (
          <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
        )}
      </Fact>
      <Fact label={t('catalog.group.measures')}>
        <Ltr>{area.measures.length}</Ltr>
      </Fact>
      <Fact label={t('catalog.group.dimensions')}>
        <Ltr>{area.dimensions.length}</Ltr>
      </Fact>
      <Fact label={t('catalog.group.marts')}>
        <Ltr>{area.marts.length}</Ltr>
      </Fact>
    </DetailShell>
  )
}

function History({ history, lang }: { history: AreaFacts['history']; lang: string }) {
  const { t } = useTranslation('boards')
  switch (history.kind) {
    case 'date':
      return <Ltr>{formatDay(history.day, lang)}</Ltr>
    case 'days':
      return <Trans t={t} i18nKey="catalog.area.historyDays" values={{ days: history.days }} components={{ n: <Ltr /> }} />
    default:
      return <span className="text-muted-foreground">{t('catalog.area.notKnown')}</span>
  }
}

/** Everyone's saved items using the area, each count a link to the library narrowed to the area (rule 3). */
function UsedBy({ usedBy }: { usedBy: AreaFacts['usedBy'] }) {
  const { t } = useTranslation('boards')
  if (!usedBy) return <span className="text-muted-foreground">{t('catalog.area.notKnown')}</span>
  return (
    <span className="flex flex-col gap-1">
      <span className="flex flex-wrap gap-x-4 gap-y-1">
        {usedBy.map((u) => (
          <Link key={u.kind} to={u.href} className="text-primary-800 underline-offset-2 hover:underline" data-catalog-used-by={u.kind}>
            <Trans t={t} i18nKey={`catalog.area.usedByKind.${u.kind}`} values={{ n: u.count }} components={{ n: <Ltr /> }} />
          </Link>
        ))}
      </span>
      <span className="text-xs text-muted-foreground">{t('catalog.area.usedByNote')}</span>
    </span>
  )
}
