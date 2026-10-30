import { useTranslation } from 'react-i18next'
import { CircleAlert, TriangleAlert } from 'lucide-react'
import { saysIn } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { RuleId } from './badges'
import type { GuardIssue } from './checks'
import { publishChecks, publishWarningKind } from './publish-checks'

type RuleName = { id: string; name: { en: string; ar: string } }

/**
 * The publish step's list of HQ's answer (oms 698): each warning and each refusal names its rule and its fact, and says
 * HQ's own words. A warning stops nothing and says so; a refusal holds the publish and reads differently.
 */
export default function PublishChecks({ issues, rules }: { issues: readonly GuardIssue[] | null | undefined; rules: readonly RuleName[] }) {
  const { t } = useTranslation('insurance-rules')
  const { warnings, refusals } = publishChecks(issues)
  if (!warnings.length && !refusals.length) return null
  return (
    <div className="flex flex-col gap-2 text-sm" data-publish-checks="">
      {refusals.length > 0 && (
        <section className="rounded-md border border-danger-border bg-danger-050 p-2 text-danger-800" data-publish-refusals={refusals.length}>
          <h3 className="flex items-center gap-1 font-medium">
            <CircleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('publishChecks.refusalsTitle')}
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {refusals.map((i, k) => (
              <Row key={k} issue={i} rules={rules} hook="refusal" label={t('publishChecks.refused')} />
            ))}
          </ul>
        </section>
      )}
      {warnings.length > 0 && (
        <section className="rounded-md border border-border bg-attention-050 p-2 text-attention-800" data-publish-warnings={warnings.length}>
          <h3 className="flex items-center gap-1 font-medium">
            <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t('publishChecks.warningsTitle')}
          </h3>
          <ul className="mt-1 flex flex-col gap-1">
            {warnings.map((i, k) => {
              const kind = publishWarningKind(i)
              return <Row key={k} issue={i} rules={rules} hook={kind} label={t(`publishChecks.kind.${kind}`)} />
            })}
          </ul>
        </section>
      )}
    </div>
  )
}

function Row({ issue, rules, hook, label }: { issue: GuardIssue; rules: readonly RuleName[]; hook: string; label: string }) {
  const { i18n } = useTranslation()
  const name = rules.find((r) => r.id === issue.ruleId)?.name
  return (
    <li className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-xs" data-publish-item={hook} data-publish-rule={issue.ruleId ?? ''} data-publish-fact={issue.fact ?? ''}>
      <span className="font-medium">{label}</span>
      {issue.ruleId && <RuleId id={issue.ruleId} />}
      {name && <bdi>{saysIn(name, i18n.language)}</bdi>}
      {issue.fact && (
        <code className="font-mono" data-fact="">
          <Ltr>{issue.fact}</Ltr>
        </code>
      )}
      <bdi className="basis-full" data-publish-text="">
        {saysIn({ en: issue.en, ar: issue.ar }, i18n.language)}
      </bdi>
    </li>
  )
}
