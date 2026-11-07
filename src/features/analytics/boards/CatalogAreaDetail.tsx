import { useTranslation } from 'react-i18next'
import type { AnalyticsCatalogArea } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import { useCatalogActions } from './CatalogActions'
import { BothOrNone, DetailShell, Fact, ServerText } from './CatalogDetailParts'

/**
 * An area node's detail (ticket 841): its name, description, owner, availability with the reason, and how many
 * members and marts it holds. 842 adds the facts (data as of, history, refresh, boundary, readBy, used-by); 843 puts
 * its author actions in `actions`.
 */
export default function CatalogAreaDetail({ area }: { area: AnalyticsCatalogArea }) {
  const { t } = useTranslation('boards')
  const { actions, below } = useCatalogActions(area)
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
