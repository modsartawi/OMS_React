import { useTranslation } from 'react-i18next'
import type { OrderInsuranceRead } from '@/core/models/order-insurance'
import Ltr from '@/core/ui/Ltr'
import { HEADING } from './facts-heading'
import InsuranceCell from './InsuranceCell'
import { planView } from './insurance-plan'

/**
 * The Insurance section's **Plan** part (ticket 788; spec 3389 user stories 55–58): the cover, the
 * clinical facts and who is billed as a list of facts, then the deductible groups with % and cap so
 * a deductible can be recomputed by hand. A blank fact reads "Not sent"; a group with no cap reads
 * "No cap", never 0. Machine values in `Ltr`, free text in `<bdi>`.
 */
export default function InsurancePlanPart({ read }: { read: OrderInsuranceRead }) {
  const { t } = useTranslation('document')
  const view = planView(read.plan, read.currency)
  return (
    <div className="flex min-w-0 flex-col gap-2" data-insurance-plan="">
      <h4 className={`${HEADING} text-muted-foreground`}>{t('insurance.plan.heading')}</h4>
      <dl className="grid min-w-0 grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 md:grid-cols-[auto_1fr_auto_1fr]">
        {view.facts.map((fact) => (
          <div key={fact.field} className="contents" data-plan-field={fact.field}>
            <dt className="text-muted-foreground">{t(`insurance.plan.fields.${fact.field}`)}</dt>
            <dd className="min-w-0 break-words pe-4">
              {fact.value === null ? (
                <span className="text-muted-foreground italic">{t('insurance.plan.notSent')}</span>
              ) : fact.kind === 'machine' ? (
                <Ltr>{fact.value}</Ltr>
              ) : (
                <bdi>{fact.value}</bdi>
              )}
            </dd>
          </div>
        ))}
      </dl>

      <h5 className="text-xs font-medium text-muted-foreground">{t('insurance.plan.groups.heading')}</h5>
      {view.groups.length === 0 ? (
        <p className="text-muted-foreground">{t('insurance.plan.groups.empty')}</p>
      ) : (
        <table className="border-collapse self-start" aria-label={t('insurance.plan.groups.label')} data-plan-groups="">
          <thead>
            <tr className="border-b border-border text-xs text-muted-foreground">
              <th scope="col" className="py-1 pe-6 text-start font-medium">
                {t('insurance.plan.groups.group')}
              </th>
              <th scope="col" className="py-1 pe-6 text-end font-medium">
                {t('insurance.plan.groups.percentage')}
              </th>
              <th scope="col" className="py-1 pe-6 text-end font-medium">
                {t('insurance.plan.groups.cap')}
              </th>
            </tr>
          </thead>
          <tbody>
            {view.groups.map((g) => (
              <tr key={g.group} className="border-b border-border last:border-b-0" data-plan-group={g.group}>
                <td className="py-1 pe-6 font-mono">
                  <Ltr>{g.group}</Ltr>
                </td>
                <td className="py-1 pe-6 text-end tabular-nums" data-plan-group-percentage="">
                  <Ltr>{g.percentage}</Ltr>
                </td>
                <td className="py-1 pe-6 text-end" data-plan-group-cap="">
                  <InsuranceCell cell={g.cap} noneKey="insurance.plan.groups.noCap" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
