import { Trans, useTranslation } from 'react-i18next'
import type { RuleBudgetLimit, RuleSessionBudgetMove, RuleSessionJournalMove, RuleSessionLineEffect, Says } from '@/core/models/rule-campaign'
import { budgetFigure } from '@/core/rules/budget'
import { moneyText } from '@/core/rules/sentence'
import { formatNumber } from '@/core/util/number-format'

// The Sessions screens' small shared renderers (ticket 518). Their figures are isolated through
// `<Trans>` slots, never `fsi`: they are drawn inside grid cells too.

/** A machine value (a figure, a code) inside a sentence. */
const V = <bdi dir="ltr" />
/** Free text (a budget's name) inside a sentence. */
const N = <bdi />

/** A text in both languages, both shown: the English, then the Arabic right to left. */
export function Both({ says }: { says: Says }) {
  return (
    <span className="flex flex-col" data-says="">
      <bdi lang="en" data-says-en="">
        {says.en}
      </bdi>
      <bdi dir="rtl" lang="ar" data-says-ar="">
        {says.ar}
      </bdi>
    </span>
  )
}

/** A budget movement: "Held SAR 40.00 of Discount money". */
export function BudgetMoveText({
  kind,
  budget,
  limit,
  amount,
  currency,
}: {
  kind: RuleSessionBudgetMove['kind']
  budget: string
  limit: RuleBudgetLimit
  amount: number
  currency: string
}) {
  const { t } = useTranslation('rule-sessions')
  return (
    <Trans
      t={t}
      i18nKey={`move.${kind}`}
      values={{ amount: budgetFigure(limit, amount, currency), budget }}
      components={{ v: V, n: N }}
    />
  )
}

/** A coupon or points movement: "Coupon WKND20 redeemed", "120 points earned". */
export function JournalMoveText({ move }: { move: Pick<RuleSessionJournalMove, 'kind' | 'code' | 'points'> }) {
  const { t } = useTranslation('rule-sessions')
  return (
    <Trans
      t={t}
      i18nKey={`journal.${move.kind}`}
      values={{ code: move.code ?? t('none'), points: move.points == null ? t('none') : formatNumber(move.points) }}
      components={{ v: V }}
    />
  )
}

/** What a campaign did to a line. An absent figure reads as a dash, never as 0. */
export function EffectText({ effect: e, currency }: { effect: RuleSessionLineEffect; currency: string }) {
  const { t } = useTranslation('rule-sessions')
  const money = e.amount == null ? t('none') : moneyText({ amount: e.amount, currency })
  return (
    <Trans
      t={t}
      i18nKey={`effect.${e.kind}`}
      values={{ amount: money, points: e.points == null ? t('none') : formatNumber(e.points), coupon: e.coupon ?? t('none') }}
      components={{ v: V }}
    />
  )
}
