import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsDimension } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import { BothOrNone, DetailShell, Fact } from './CatalogDetailParts'

/** A dimension node's detail (ticket 841): label, kind, description and its inline values when it has them. */
export default function CatalogDimensionDetail({ dimension }: { dimension: AnalyticsDimension }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  return (
    <DetailShell kind={t('catalog.kind.dimension')} title={dimension.label} machineKey={dimension.key} actions={null} data="dimension">
      <Fact label={t('catalog.fact.description')}>
        <BothOrNone says={dimension.description} />
      </Fact>
      <Fact label={t('catalog.fact.dimensionKind')} data="dimension-kind">
        {t(`catalog.dimensionKind.${dimension.kind}`, { defaultValue: dimension.kind })}
      </Fact>
      {dimension.values.length > 0 && (
        <Fact label={t('catalog.fact.values')}>
          <ul className="flex flex-col gap-0.5">
            {dimension.values.map((v) => (
              <li key={v.key}>
                <bdi>{saysIn(v.label, lang) || v.key}</bdi>
              </li>
            ))}
          </ul>
        </Fact>
      )}
    </DetailShell>
  )
}
