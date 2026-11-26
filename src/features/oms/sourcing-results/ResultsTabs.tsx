import type { ComponentType } from 'react'
import { useTranslation } from 'react-i18next'
import type { ResultsQuery, ResultsSummaryReply } from '@/core/models/sourcing-results'
import Chip from '@/core/ui/Chip'
import BarTab from './BarTab'
import { RESULTS_TABS, type ResultsTab } from './tabs'
import TrialsTab from './TrialsTab'

/** What every tab's panel is handed: the filters as the door takes them, and the summary already read. */
export interface ResultsTabProps {
  query: ResultsQuery
  summary: ResultsSummaryReply
}

/**
 * Each tab's panel, by the ticket that builds it: 972 registers `breakdowns`, `outside-rules`, `checks`,
 * `later-slots` and `not-run`; 973 registers `trials` and `phase-2-bar`. A panel opens its figures with `<Drill />`.
 */
const TAB_PANELS: Partial<Record<ResultsTab, ComponentType<ResultsTabProps>>> = {
  trials: TrialsTab,
  'phase-2-bar': BarTab,
}

/**
 * The seven tabs under "Where the plans differ" (ticket 971, spec 4354 §17): a tablist and the ONE open panel. Tab ids
 * are `results-tab-<tab>`, the panel `results-tab-panel`; each tab carries `data-tab`, the panel `data-tab-panel`.
 */
export default function ResultsTabs({ open, onSelect, ...props }: { open: ResultsTab; onSelect: (tab: ResultsTab) => void } & ResultsTabProps) {
  const { t } = useTranslation('sourcing-results')
  const Panel = TAB_PANELS[open]
  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4" data-results-tabs="">
      <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1">
        {RESULTS_TABS.map((tab) => (
          <Chip
            key={tab}
            variant="tab"
            on={open === tab}
            id={`results-tab-${tab}`}
            aria-controls="results-tab-panel"
            onClick={() => tab !== open && onSelect(tab)}
            data-tab={tab}
          >
            {t(`tabs.names.${tab}`)}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" id="results-tab-panel" aria-labelledby={`results-tab-${open}`} data-tab-panel={open}>
        {Panel ? (
          <Panel {...props} />
        ) : (
          <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-tab-pending="">
            {t('tabs.pending')}
          </p>
        )}
      </div>
    </section>
  )
}
