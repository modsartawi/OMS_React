import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import VerticalBarChart from '@/core/charts/VerticalBarChart'
import type { ResultsLaterSlotsReply } from '@/core/models/sourcing-results'
import { fsi } from '@/core/util/bidi'
import { readingTabsApi } from './api'
import Drill, { useDrill } from './Drill'
import Fig from './Fig'
import { laterSlots } from './later-slots-model'
import { PILL } from './Panels'
import type { ResultsTabProps } from './ResultsTabs'
import TabRead from './TabRead'
import { countText, percentText } from './text'

/**
 * Later slots (ticket 972, results ticket decision 12): one sentence and a bar per hour the order came in, marked
 * "evidence for phase 2". The count changes no plan and is read, never a limit (spec 4354 §18). No riyal figure.
 */
export default function LaterSlotsTab({ query }: ResultsTabProps) {
  const read = useQuery({
    queryKey: ['sourcing-results', 'later-slots', query],
    queryFn: () => readingTabsApi.laterSlots(query),
    placeholderData: keepPreviousData,
    retry: false,
  })
  return (
    <div className="flex flex-col gap-3" data-reading-tab="later-slots">
      <TabRead read={read}>{(reply) => <LaterSlots reply={reply} />}</TabRead>
    </div>
  )
}

function LaterSlots({ reply }: { reply: ResultsLaterSlotsReply }) {
  const { t, i18n } = useTranslation('sourcing-results')
  const drill = useDrill()
  const model = laterSlots(reply)
  const s = model.sentence
  const peak = model.peak == null ? null : model.hours[model.peak]
  return (
    <div className="flex flex-col gap-3">
      <p className="max-w-[78ch] text-sm" data-later-slots-sentence="">
        <Trans
          t={t}
          i18nKey={s.middleLaterMinutes == null ? 'laterSlots.sentenceNoMiddle' : 'laterSlots.sentence'}
          components={{
            b: <b />,
            orders: <Drill figure={{ kind: 'laterSlot', hour: null }} count={s.orders} />,
            share: <Fig value={percentText(s.percent)} />,
            slot: <Fig value={countText(s.slotOrders)} />,
            minutes: <Fig value={String(s.middleLaterMinutes ?? '')} />,
          }}
        />{' '}
        <span className={`${PILL} border-primary/30 bg-primary-050 text-primary-800`} data-phase2-evidence="">
          {t('laterSlots.evidence')}
        </span>
      </p>
      <p className="max-w-[78ch] text-xs text-muted-foreground">{t('laterSlots.note')}</p>
      {model.empty ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-later-slots-empty="">
          {t('laterSlots.empty')}
        </p>
      ) : (
        <div data-later-slots-chart="">
          <VerticalBarChart
            points={model.hours.map((h) => ({ member: String(h.hour), label: h.label, value: h.orders, slot: null }))}
            colourBy="single"
            unit="count"
            measureLabel={t('laterSlots.measure')}
            locale={i18n.language}
            ariaLabel={t('laterSlots.chartLabel', { peak: fsi(peak ? `${peak.label}:00` : '') })}
            height={220}
            onPoint={(member) => drill({ kind: 'laterSlot', hour: Number(member) })}
          />
          <p className="text-center text-xs text-muted-foreground">{t('laterSlots.axis')}</p>
        </div>
      )}
    </div>
  )
}
