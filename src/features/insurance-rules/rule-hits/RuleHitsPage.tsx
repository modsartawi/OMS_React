import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Download, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { DeniedCard, Loading, NUM, TD, TH } from '@/core/insurance-rules/parts'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatDateTime } from '@/core/util/date-format'
import { saveBlob } from '@/core/util/download-file'
import { formatFigure, formatNumber } from '@/core/util/number-format'
import { RULE_HIT_OUTCOMES, ruleHitsApi, ruleHitsFileName, ruleHitsQuery, type RuleHit } from './api'
import { RULE_HIT_KINDS, ruleHitsFromParams, ruleHitsToParams, windowOf, type RuleHitsQuery } from './query'

/**
 * Insurance rules ▸ Rule hits — `/insurance-rules/rule-hits` (BackOffice spec 3972, door 3980, ticket 3981). Every
 * guard rule fire in a local window (last calendar month by default), filtered by rule, payer, store and live or
 * shadow, and the same query downloaded as the server's Excel. The address is the state (`useUrlQuery`). Read-only.
 *
 * Gated on its own grant (`InsuranceRuleHits`, probe flag `canRuleHits`): the rows carry national ids, so no rules
 * grant opens it; a deep link without the grant reads the door's bare 403 as "You do not have access".
 * 🚩 Never log a row — `patientKey` is a national id.
 */
export default function RuleHitsPage() {
  const { t } = useTranslation('insurance-rule-hits')
  const { query, update } = useUrlQuery(ruleHitsFromParams, ruleHitsToParams)
  const problem = windowOf(query)
  const set = (patch: Partial<RuleHitsQuery>) => update((q) => ({ ...q, ...patch }))

  return (
    <section className="flex w-full flex-col gap-4" data-rule-hits-page="">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        </div>
        <ExcelButton query={query} disabled={problem !== null} />
      </header>

      <FilterBar query={query} set={set} />

      {problem ? (
        <p className="rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-window-problem={problem}>
          {t(`window.${problem}`)}
        </p>
      ) : (
        <HitsTable query={query} />
      )}
    </section>
  )
}

function FilterBar({ query, set }: { query: RuleHitsQuery; set: (patch: Partial<RuleHitsQuery>) => void }) {
  const { t } = useTranslation('insurance-rule-hits')
  // Rule, payer and store are typed: they apply on leaving the box, and Enter leaves it. Keyed on the address so
  // Back resets them.
  const typed = (field: 'rule' | 'payer' | 'store') => ({
    defaultValue: query[field],
    onBlur: (e: React.FocusEvent<HTMLInputElement>) => {
      const value = e.target.value.trim()
      if (value !== query[field]) set({ [field]: value })
    },
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => e.key === 'Enter' && e.currentTarget.blur(),
    className: field === 'payer' ? 'w-36' : 'w-28',
    dir: 'ltr' as const,
    'data-filter': field,
  })
  return (
    <fieldset className="flex flex-wrap items-end gap-2" data-rule-hits-filter="">
      <legend className="sr-only">{t('filter.label')}</legend>
      <Field label={t('window.from')}>
        <Input type="date" value={query.from} onChange={(e) => e.target.value && set({ from: e.target.value })} data-filter="from" />
      </Field>
      <Field label={t('window.to')}>
        <Input type="date" value={query.to} onChange={(e) => e.target.value && set({ to: e.target.value })} data-filter="to" />
      </Field>
      <Field label={t('filter.rule')}>
        <Input key={`rule:${query.rule}`} {...typed('rule')} />
      </Field>
      <Field label={t('filter.payer')}>
        <Input key={`payer:${query.payer}`} {...typed('payer')} />
      </Field>
      <Field label={t('filter.store')}>
        <Input key={`store:${query.store}`} {...typed('store')} />
      </Field>
      <div className="flex flex-col gap-1">
        <span className="text-xs font-medium text-muted-foreground" id="rule-hits-kind">
          {t('filter.kind')}
        </span>
        <div className="flex gap-1" role="group" aria-labelledby="rule-hits-kind" data-filter="kind">
          {RULE_HIT_KINDS.map((kind) => (
            <Chip key={kind} on={query.kind === kind} onClick={() => set({ kind })} data-kind={kind}>
              {t(`kind.${kind}`)}
            </Chip>
          ))}
        </div>
      </div>
    </fieldset>
  )
}

/** The server's `.xlsx` for the query on screen, saved under its own name (the fallback only when it sends none). */
function ExcelButton({ query, disabled }: { query: RuleHitsQuery; disabled: boolean }) {
  const { t } = useTranslation('insurance-rule-hits')
  const [busy, setBusy] = useState(false)
  const onClick = async () => {
    setBusy(true)
    try {
      const file = await ruleHitsApi.excel(query)
      saveBlob(file.filename ?? ruleHitsFileName(query), file.blob)
    } catch (err) {
      notify.apiError(t('downloadFailed'), err, t('downloadFailed'))
    } finally {
      setBusy(false)
    }
  }
  return (
    <Button variant="outlined" disabled={busy || disabled} aria-busy={busy || undefined} onClick={onClick} data-rule-hits-excel="">
      {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Download className="h-3.5 w-3.5" aria-hidden />}
      {t('download')}
    </Button>
  )
}

function HitsTable({ query }: { query: RuleHitsQuery }) {
  const { t } = useTranslation('insurance-rule-hits')
  const hits = useQuery({ ...ruleHitsQuery(query), placeholderData: keepPreviousData })

  if (hits.isError && isBareDenial(hits.error)) return <DeniedCard ns="insurance-rule-hits" hook="rule-hits-denied" />
  if (hits.isError) return <ErrorBanner className="p-3" message={apiErrorMessage(hits.error, t('failed'))} />
  if (!hits.data) return <Loading text={t('loading')} />
  const { rows } = hits.data
  if (rows.length === 0)
    return (
      <p className="rounded-md border border-border/60 py-6 text-center text-sm text-muted-foreground" data-rule-hits-empty="">
        {t('empty')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground" data-rule-hits-total="">
        <Trans t={t} i18nKey="total" count={rows.length} values={{ n: formatFigure(rows.length) }} components={{ v: <Ltr /> }} />
      </p>
      <div className="overflow-x-auto rounded-md border border-border/60">
        <table className="w-full text-sm" data-rule-hits="">
          <thead className="bg-muted/50">
            <tr>
              <th className={TH}>{t('columns.firedAt')}</th>
              <th className={TH}>{t('columns.store')}</th>
              <th className={TH}>{t('columns.staff')}</th>
              <th className={TH}>{t('columns.patientKey')}</th>
              <th className={TH}>{t('columns.payer')}</th>
              <th className={TH}>{t('columns.policy')}</th>
              <th className={TH}>{t('columns.item')}</th>
              <th className={`${TH} text-end`}>{t('columns.quantity')}</th>
              <th className={TH}>{t('columns.rule')}</th>
              <th className={TH}>{t('columns.checkpoint')}</th>
              <th className={TH}>{t('columns.channel')}</th>
              <th className={TH}>{t('columns.severity')}</th>
              <th className={TH}>{t('columns.outcome')}</th>
              <th className={TH}>{t('columns.message')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((h) => (
              <HitRow key={`${h.checkId}|${h.lineNumber}|${h.ruleId}`} h={h} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const isOutcome = (o: string): o is (typeof RULE_HIT_OUTCOMES)[number] => (RULE_HIT_OUTCOMES as readonly string[]).includes(o)

function HitRow({ h }: { h: RuleHit }) {
  const { t, i18n } = useTranslation('insurance-rule-hits')
  const message = i18n.language.startsWith('ar') ? h.messageAr || h.messageEn : h.messageEn || h.messageAr
  return (
    <tr className="border-t border-border/60" data-hit={h.checkId} data-outcome={h.outcome} data-kind={h.kind}>
      <td className={`${TD} whitespace-nowrap`} data-col="firedAt">
        <Ltr>{formatDateTime(h.firedAt)}</Ltr>
      </td>
      <td className={TD} data-col="store">
        <Ltr>{h.store}</Ltr>
      </td>
      <td className={TD} data-col="staff">
        {h.staff && <Ltr>{h.staff}</Ltr>}
      </td>
      <td className={TD} data-col="patientKey">
        {h.patientKey && <Ltr>{h.patientKey}</Ltr>}
      </td>
      <td className={TD} data-col="payer">
        {h.payer && <Ltr>{h.payer}</Ltr>}
      </td>
      <td className={TD} data-col="policy">
        {h.policy && <Ltr>{h.policy}</Ltr>}
      </td>
      <td className={TD} data-col="item">
        {h.item && <Ltr>{h.item}</Ltr>}
      </td>
      <td className={NUM} data-col="quantity">
        <Ltr>{formatNumber(h.quantity)}</Ltr>
      </td>
      <td className={TD} data-col="rule">
        <Ltr>{h.ruleId}</Ltr>
        <span className="block text-xs text-muted-foreground">
          <Trans t={t} i18nKey="version" values={{ version: String(h.version) }} components={{ v: <Ltr /> }} />
        </span>
      </td>
      <td className={TD} data-col="checkpoint">
        {t(`checkpoint.${h.checkpoint === 'dispense' ? 'dispense' : 'submit'}`)}
      </td>
      <td className={TD} data-col="channel">
        {h.channel && <Ltr>{h.channel}</Ltr>}
        {h.requestReference && (
          <span className="block text-xs text-muted-foreground">
            <Ltr>{h.requestReference}</Ltr>
          </span>
        )}
      </td>
      <td className={TD} data-col="severity">
        <Ltr>{h.severity}</Ltr>
      </td>
      <td className={TD} data-col="outcome">
        {isOutcome(h.outcome) ? t(`outcome.${h.outcome}`) : <Ltr>{h.outcome}</Ltr>}
        {h.exceptionId && (
          <span className="block text-xs text-muted-foreground">
            <Trans t={t} i18nKey="exception" values={{ id: h.exceptionId }} components={{ v: <Ltr /> }} />
          </span>
        )}
      </td>
      <td className={TD} data-col="message">
        {message && <bdi>{message}</bdi>}
      </td>
    </tr>
  )
}
