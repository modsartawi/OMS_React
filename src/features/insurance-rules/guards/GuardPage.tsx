import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useLocation, useParams } from 'react-router'
import { ArrowLeft, Loader2, Pencil } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import { GuardSeverityBadge, GuardStateBadge, RuleId } from '@/core/insurance-rules/badges'
import GuardSentenceView, { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import { guardEditPath, guardsPath, ruleSeverity, type GuardList, type GuardRule } from '@/core/insurance-rules/model'
import { guardSentence } from '@/core/insurance-rules/sentence'
import SaysBoth from '@/core/rules/SaysBoth'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { formatDay } from '@/core/util/date-format'
import OrganizeCard from './OrganizeCard' // 609
import { DeniedCard } from '@/core/insurance-rules/parts'

/**
 * Insurance rules ▸ Guards ▸ one rule — `/insurance-rules/guards/:ruleId` (oms ticket 607). The rule read-only,
 * written as sentences: WHEN (channels, stores, window), IF (the conditions; All of / Any of indented, NOT in
 * the words), THEN (what the severity does, the EN + AR message, codes, suggestion) and what an unknown fact
 * does. Read from the guard ruleset (`GET InsuranceRules/Guards/Draft`); 608's editor opens from here.
 */
export default function GuardPage() {
  const { t } = useTranslation('insurance-guards')
  const { ruleId = '' } = useParams()
  const from = (useLocation().state as { folder?: string } | null)?.folder ?? ''
  const draft = useQuery(guardDraftQuery())
  const rule = draft.data?.rules.find((r) => r.id === ruleId)

  let body: ReactNode
  if (draft.isError && isBareDenial(draft.error)) body = <DeniedCard ns="insurance-guards" hook="rule-denied" />
  else if (draft.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(draft.error, t('rule.failed'))} />
  else if (!draft.data)
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rule.loading')}
      </div>
    )
  else if (!rule)
    body = (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" role="alert" data-rule-not-found="">
        {t('rule.notFound')} <RuleId id={ruleId} />
      </p>
    )
  else
    body = (
      <>
        <RuleRead rule={rule} lists={draft.data.lists} />
        {/* 609 — move to a folder, save as a team template */}
        <OrganizeCard key={rule.id} rule={rule} rules={draft.data.rules} />
      </>
    )

  return (
    <section className="flex w-full max-w-4xl flex-col gap-4" data-guard-page="">
      <Link to={guardsPath(from)} className="inline-flex w-fit items-center gap-1 text-sm text-primary hover:underline" data-back="">
        <ArrowLeft className="h-4 w-4 rtl:rotate-180" aria-hidden />
        {t('rule.back')}
      </Link>
      {body}
    </section>
  )
}

function RuleRead({ rule, lists }: { rule: GuardRule; lists: GuardList[] }) {
  const { t } = useTranslation('insurance-guards')
  const s = guardSentence(rule, lists)
  const severity = ruleSeverity(rule)
  return (
    <>
      <header className="flex flex-col gap-2" data-rule-header="">
        <div className="flex flex-wrap items-center gap-2">
          <RuleId id={rule.id} />
          <GuardStateBadge state={rule.state} />
          {severity && <GuardSeverityBadge severity={severity} />}
          <Link to={guardEditPath(rule.id)} className="ms-auto inline-flex h-7 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium hover:bg-accent" data-edit-rule="">
            <Pencil className="h-3.5 w-3.5" aria-hidden />
            {t('rule.edit')}
          </Link>
        </div>
        <h1 className="text-lg font-semibold tracking-tight" data-rule-name="">
          <SaysBoth says={rule.name} />
        </h1>
        <dl className="flex flex-wrap gap-x-6 gap-y-1 text-sm text-muted-foreground">
          <div className="flex gap-1">
            <dt>{t('rule.folder')}</dt>
            <dd data-rule-folder="">
              <bdi>{rule.folder || t('rule.noFolder')}</bdi>
            </dd>
          </div>
          {rule.state === 'shadow' && rule.shadowSince && (
            <div className="flex gap-1">
              <dt>{t('rule.shadowSince')}</dt>
              <dd data-shadow-since="">
                <Ltr>{formatDay(rule.shadowSince)}</Ltr>
              </dd>
            </div>
          )}
        </dl>
      </header>

      <Block kw={t('rule.when')} hint={t('rule.whenHint')} hook="when">
        <ul className="flex flex-col gap-1">
          {s.when.map((w, i) => (
            <li key={i} data-sentence="">
              <GuardSentenceView s={w} />
            </li>
          ))}
        </ul>
      </Block>

      <Block kw={t('rule.if')} hint={t('rule.ifHint')} hook="if">
        <ConditionTree nodes={s.conditions} />
        <p className="mt-2 text-xs text-muted-foreground" data-on-unknown="">
          <GuardSentenceView s={s.onUnknown} />
        </p>
      </Block>

      <Block kw={t('rule.then')} hint={t('rule.thenHint')} hook="then">
        <div className="flex flex-col gap-3">
          {s.then.map((e, i) => (
            <div key={i} className="flex flex-col gap-1.5" data-effect={e.severity}>
              <div className="flex flex-wrap items-center gap-2">
                <GuardSeverityBadge severity={e.severity} />
                <span data-sentence="">
                  <GuardSentenceView s={e.does} />
                </span>
              </div>
              <div className="rounded-md border border-border/60 bg-muted/40 p-2 text-sm" data-message="">
                <div className="mb-1 text-xs text-muted-foreground">{t('rule.message')}</div>
                <SaysBoth says={e.says} />
              </div>
              {e.codes.length > 0 && (
                <p className="text-sm" data-codes="">
                  {e.codes.map((c, j) => (
                    <span key={j}>
                      {j > 0 && ' · '}
                      <GuardSentenceView s={c} />
                    </span>
                  ))}
                </p>
              )}
              {e.suggest.map((c, j) => (
                <p key={j} className="text-sm" data-suggest="">
                  <GuardSentenceView s={c} />
                </p>
              ))}
            </div>
          ))}
        </div>
      </Block>
    </>
  )
}

function Block({ kw, hint, hook, children }: { kw: string; hint: string; hook: string; children: ReactNode }) {
  return (
    <section className="rounded-lg border border-border/60 bg-card" {...{ [`data-block-${hook}`]: '' }}>
      <div className="flex items-baseline gap-2 border-b border-border/60 px-3 py-2">
        <span className="font-mono text-xs font-semibold tracking-wider text-primary">{kw}</span>
        <span className="text-xs text-muted-foreground">{hint}</span>
      </div>
      <div className="p-3 text-sm leading-relaxed">{children}</div>
    </section>
  )
}
