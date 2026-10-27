import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { INSURANCE_RULES_KEY } from '@/core/insurance-rules/api'
import { RuleId } from '@/core/insurance-rules/badges'
import { INSURANCE_RULES_PATH } from '@/core/insurance-rules/model'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { simulateCategories } from './api'
import { categorySimulateBody, lineCategory, type LineCategory } from './category'
import type { SimulateBody } from './simulate'

/**
 * Which category a simulated line got and who set it (story 61; 617 on BackOffice 3145): a category rule (linked to
 * it), the item's own default (its spelling, Brand-IR included), or none. One `POST InsuranceRules/Categories/Simulate`
 * per request asked, shared by every line (one query key).
 */
export default function CategoryNote({ asked, line }: { asked: SimulateBody; line: number }) {
  const { t } = useTranslation('insurance-simulator')
  const answer = useQuery({
    queryKey: [...INSURANCE_RULES_KEY, 'categories', 'simulate', asked],
    queryFn: () => simulateCategories(categorySimulateBody(asked)),
    retry: false,
  })
  if (answer.isError)
    return (
      <span className="ms-auto text-xs text-muted-foreground" data-line-category-failed="">
        {t('result.category.failed')}
      </span>
    )
  const c = lineCategory(answer.data, line)
  if (!c) return null
  return (
    <span className="ms-auto flex flex-col items-end gap-0.5 text-xs text-muted-foreground">
      <Note c={c} />
      {(c.version !== null || c.unknowns.length > 0) && (
        <span className="flex flex-wrap items-center justify-end gap-1.5" data-category-meta="">
          {c.unknowns.length > 0 && (
            <span className="inline-flex flex-wrap items-center gap-1 text-attention-800" data-category-unknowns={c.unknowns.join(' ')}>
              {t('result.category.unknowns')}
              {c.unknowns.map((id) => (
                <RuleId key={id} id={id} />
              ))}
            </span>
          )}
          {c.version !== null && (
            <span data-category-version={c.version}>
              <Trans t={t} i18nKey="result.category.version" values={{ version: formatNumber(c.version) }} components={{ v: <Ltr /> }} />
            </span>
          )}
        </span>
      )}
    </span>
  )
}

function Note({ c }: { c: LineCategory }) {
  const { t } = useTranslation('insurance-simulator')
  return (
    <span data-line-category={c.group ?? ''} data-category-source={c.source} data-category-rule={c.ruleId ?? ''}>
      {c.source === 'none' ? (
        t('result.category.none')
      ) : (
        <>
          {t('result.category.label')} <span className="font-medium text-foreground">{c.group ? t(`result.category.group.${c.group}`) : <Ltr>{c.category ?? ''}</Ltr>}</span>{' '}
          {c.source === 'rule' && c.ruleId ? (
            <>
              {t('result.category.setBy')}{' '}
              <Link to={`${INSURANCE_RULES_PATH}/categories?rule=${encodeURIComponent(c.ruleId)}`} className="text-primary hover:underline" data-category-link={c.ruleId}>
                <RuleId id={c.ruleId} />
              </Link>
            </>
          ) : (
            <>
              {t('result.category.itemDefault')}
              {c.category && (
                <>
                  {' '}
                  <code className="font-mono" data-default-category="">
                    <Ltr>{c.category}</Ltr>
                  </code>
                </>
              )}
            </>
          )}
        </>
      )}
    </span>
  )
}
