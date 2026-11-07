import { useTranslation } from 'react-i18next'
import type { AnalyticsCatalogSource } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { DetailShell, Fact, KeyList, ServerText } from './CatalogDetailParts'

/**
 * A source table node's detail (ticket 841, spec 3437 story 28): server, database and table — each its own machine
 * value, on its own row — the description, and which marts use it.
 */
export default function CatalogSourceDetail({ sourceKey, source }: { sourceKey: string; source: AnalyticsCatalogSource | null }) {
  const { t } = useTranslation('boards')
  return (
    <DetailShell kind={t('catalog.kind.source')} title={null} machineKey={sourceKey} actions={null} data="source">
      {!source ? (
        <Fact label={t('catalog.fact.description')}>
          <span className="text-muted-foreground">{t('catalog.notDescribed')}</span>
        </Fact>
      ) : (
        <>
          <Fact label={t('catalog.fact.server')} data="server">
            <Ltr>{source.server}</Ltr>
          </Fact>
          <Fact label={t('catalog.fact.database')} data="database">
            <Ltr>{source.database}</Ltr>
          </Fact>
          <Fact label={t('catalog.fact.table')} data="table">
            <Ltr>{source.table}</Ltr>
          </Fact>
          <Fact label={t('catalog.fact.description')}>
            <ServerText text={source.description} />
          </Fact>
          <Fact label={t('catalog.fact.usedBy')} data="used-by">
            <KeyList keys={source.usedBy} empty={t('catalog.noMarts')} data="used-by" />
          </Fact>
        </>
      )}
    </DetailShell>
  )
}
