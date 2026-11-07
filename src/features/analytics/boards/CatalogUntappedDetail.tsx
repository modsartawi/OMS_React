import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsCatalogPlanned, AnalyticsCatalogUntapped } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { DetailShell, Fact, ServerText } from './CatalogDetailParts'

/**
 * An untapped source's detail (ticket 842, spec 3437 story 33): a known source table no mart reads yet — server,
 * database and table, each its own machine value — its note, and the planned areas that would read it.
 */
export default function CatalogUntappedDetail({ untapped, plannedBy }: { untapped: AnalyticsCatalogUntapped; plannedBy: AnalyticsCatalogPlanned[] }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  return (
    <DetailShell kind={t('catalog.untapped.kind')} title={null} machineKey={untapped.key} actions={null} data="untapped">
      <Fact label={t('catalog.fact.server')} data="server">
        <Ltr>{untapped.server}</Ltr>
      </Fact>
      <Fact label={t('catalog.fact.database')} data="database">
        <Ltr>{untapped.database}</Ltr>
      </Fact>
      <Fact label={t('catalog.fact.table')} data="table">
        <Ltr>{untapped.table}</Ltr>
      </Fact>
      <Fact label={t('catalog.untapped.note')} data="note">
        <ServerText text={untapped.note} />
      </Fact>
      <Fact label={t('catalog.untapped.plannedBy')} data="planned-by">
        {plannedBy.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.untapped.plannedByNone')}</span>
        ) : (
          <ul className="flex flex-col gap-0.5" data-catalog-planned-by>
            {plannedBy.map((p) => (
              <li key={p.key}>
                <bdi>{saysIn(p.label, lang) || p.key}</bdi>
              </li>
            ))}
          </ul>
        )}
      </Fact>
    </DetailShell>
  )
}
