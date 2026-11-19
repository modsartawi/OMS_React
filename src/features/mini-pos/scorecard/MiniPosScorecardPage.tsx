import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Play } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import ScreenGate from '@/core/ui/ScreenGate'
import type { MiniPosScorecardQuery } from '@/core/models/mini-pos-scorecard'
import { canOpenMiniPosScorecard } from './access'
import { miniPosScorecardApi } from './api'
import { EMPTY_DRAFT, draftToQuery, queryParams, scorecardFailure, type ScorecardDraft } from './scorecard'
import { MoneyTest, ScorecardFailureBanner, ScorecardNotes, SupportingMeasures, TrialWindow, WeeklyView } from './ScorecardViews'

const NS = 'mini-pos-scorecard'

/**
 * The Mini POS scorecard (oms 918, BackOffice spec 4063, door 4075): the panel's money test — trial against control
 * pharmacies, the uplift, the gross margin on it and the payback ratio against the 1.0× and 1.2× bars, with the promoter
 * cost the panel enters — the supporting measures, and the weekly view the operations and IT reviewers read (3710 M10-M15).
 *
 * Behind `canOpenMiniPosScorecard` (`MiniPosScorecard:03`), failing closed. A blank date or offset is not sent: SIS.Api's
 * configured trial calendar answers for it.
 */
export default function MiniPosScorecardPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canOpenMiniPosScorecard} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <Scorecard />
    </ScreenGate>
  )
}

function Scorecard() {
  const { t } = useTranslation(NS)
  const [draft, setDraft] = useState<ScorecardDraft>(EMPTY_DRAFT)
  const [query, setQuery] = useState<MiniPosScorecardQuery>({})
  const read = useQuery({
    queryKey: ['mini-pos', 'scorecard', queryParams(query)],
    queryFn: () => miniPosScorecardApi.read(query),
    retry: false,
  })
  const set = (patch: Partial<ScorecardDraft>) => setDraft((d) => ({ ...d, ...patch }))
  const data = read.data

  return (
    <div className="flex flex-col gap-5">
      <ScorecardNotes />
      <form
        className="grid grid-cols-1 gap-3 rounded-lg border border-border/60 bg-card/40 p-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end"
        onSubmit={(e) => {
          e.preventDefault()
          setQuery(draftToQuery(draft))
        }}
        data-minipos-scorecard-form=""
      >
        <Field id="minipos-sc-from" label={t('form.trialFrom')}>
          <Input type="date" value={draft.trialFrom} onChange={(e) => set({ trialFrom: e.target.value })} className="w-full" />
        </Field>
        <Field id="minipos-sc-to" label={t('form.trialTo')}>
          <Input type="date" value={draft.trialTo} onChange={(e) => set({ trialTo: e.target.value })} className="w-full" />
        </Field>
        <Field id="minipos-sc-settling" label={t('form.settlingInEnd')}>
          <Input type="date" value={draft.settlingInEnd} onChange={(e) => set({ settlingInEnd: e.target.value })} className="w-full" />
        </Field>
        <Field id="minipos-sc-offset" label={t('form.offset')}>
          <Input
            type="number"
            min={1}
            max={400}
            step={1}
            inputMode="numeric"
            value={draft.comparisonOffsetDays}
            onChange={(e) => set({ comparisonOffsetDays: e.target.value })}
            className="w-full"
          />
        </Field>
        <Field id="minipos-sc-cost" label={t('form.cost')}>
          <Input
            type="number"
            min={0}
            step="0.01"
            inputMode="decimal"
            value={draft.promoterCost}
            onChange={(e) => set({ promoterCost: e.target.value })}
            className="w-full"
            data-minipos-promoter-cost=""
          />
        </Field>
        <Button type="submit" variant="primary" disabled={read.isFetching}>
          {read.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Play className="h-3.5 w-3.5" aria-hidden />}
          {t('form.run')}
        </Button>
        <p className="text-xs text-muted-foreground sm:col-span-2 lg:col-span-6">
          {t('form.configHint')} {t('form.costHint')}
        </p>
      </form>

      {read.isError ? (
        <ScorecardFailureBanner failure={scorecardFailure(read.error, t('failed'))} />
      ) : read.isPending ? (
        <p className="text-sm text-muted-foreground">{t('loading')}</p>
      ) : data ? (
        <>
          <TrialWindow inputs={data.inputs} />
          <MoneyTest money={data.money} inputs={data.inputs} />
          <WeeklyView weekly={data.weekly} trialFrom={data.inputs.trialFrom} />
          <SupportingMeasures supporting={data.supporting} />
        </>
      ) : null}
    </div>
  )
}
