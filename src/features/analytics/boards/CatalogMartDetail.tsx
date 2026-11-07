import { useTranslation } from 'react-i18next'
import type { AnalyticsCatalogMart } from '@/core/models/analytics'
import { DetailShell, Fact, KeyList, ServerText } from './CatalogDetailParts'

/**
 * A mart / fact / dim node's detail (ticket 841, spec 3437 story 27): kind, description, grain and the source tables
 * it is built from. Description and grain are the dbt's English text (`<bdi>`, not keyed). 844 adds the curator's
 * raw preview in `actions` and the hidden-column count here.
 */
export default function CatalogMartDetail({ martKey, mart }: { martKey: string; mart: AnalyticsCatalogMart | null }) {
  const { t } = useTranslation('boards')
  return (
    <DetailShell kind={t(`catalog.martKind.${mart?.kind ?? 'mart'}`)} title={null} machineKey={martKey} actions={null} data="mart">
      {!mart ? (
        <Fact label={t('catalog.fact.description')}>
          <span className="text-muted-foreground">{t('catalog.notDescribed')}</span>
        </Fact>
      ) : (
        <>
          <Fact label={t('catalog.fact.description')}>
            <ServerText text={mart.description} />
          </Fact>
          <Fact label={t('catalog.fact.grain')} data="grain">
            <ServerText text={mart.grain} />
          </Fact>
          <Fact label={t('catalog.fact.sources')} data="sources">
            <KeyList keys={mart.sources} empty={t('catalog.noSources')} data="sources" />
          </Fact>
        </>
      )}
    </DetailShell>
  )
}
