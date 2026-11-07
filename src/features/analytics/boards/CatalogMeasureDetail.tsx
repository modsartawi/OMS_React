import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsCatalogArea, AnalyticsMeasure } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { cannotCutBy } from './catalog-tree'
import { BothOrNone, DetailShell, Fact } from './CatalogDetailParts'

/**
 * A measure node's detail (ticket 841, spec 3437 stories 19–20): label, unit, shape, description, and the area's
 * dimensions it cannot be cut by. 843 puts "New view from this" / "Ask about this area" in `actions`.
 */
export default function CatalogMeasureDetail({ area, measure }: { area: AnalyticsCatalogArea; measure: AnalyticsMeasure }) {
  const { t } = useTranslation('boards')
  const lang = i18n.language
  const notBy = cannotCutBy(area, measure)
  return (
    <DetailShell kind={t('catalog.kind.measure')} title={measure.label} machineKey={measure.key} actions={null} data="measure">
      <Fact label={t('catalog.fact.description')}>
        <BothOrNone says={measure.description} />
      </Fact>
      <Fact label={t('catalog.fact.unit')} data="unit">
        {t(`catalog.unit.${measure.unit}`, { defaultValue: measure.unit })}
      </Fact>
      <Fact label={t('catalog.fact.shape')} data="shape">
        {t(`catalog.shape.${measure.shape}`, { defaultValue: measure.shape })}
      </Fact>
      {measure.maxWindowDays != null && (
        <Fact label={t('catalog.fact.maxWindow')}>
          <Ltr>{measure.maxWindowDays}</Ltr>
        </Fact>
      )}
      {measure.caveat && (measure.caveat.en || measure.caveat.ar) && (
        <Fact label={t('catalog.fact.caveat')}>
          <BothOrNone says={measure.caveat} />
        </Fact>
      )}
      <Fact label={t('catalog.fact.cannotCutBy')} data="cannot-cut-by">
        {notBy.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.everyDimension')}</span>
        ) : (
          <ul className="flex flex-col gap-0.5">
            {notBy.map((d) => (
              <li key={d.key} className="flex flex-wrap items-baseline gap-2" data-catalog-not-by={d.key}>
                <bdi>{saysIn(d.label, lang) || d.key}</bdi>
                <span className="text-xs text-muted-foreground">
                  <Ltr>{d.key}</Ltr>
                </span>
              </li>
            ))}
          </ul>
        )}
      </Fact>
    </DetailShell>
  )
}
