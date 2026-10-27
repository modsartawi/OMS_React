import { useTranslation } from 'react-i18next'
import { useUrlQuery } from '@/core/ui/use-url-query'
import FlagsTab from './FlagsTab'
import MetricsTab from './MetricsTab'
import { METRICS_TABS, metricsFromParams, metricsToParams, windowOf, type MetricsQuery } from './query'
import RejectionsTab from './RejectionsTab'
import { INPUT } from '@/core/insurance-rules/parts'

const PANEL_ID = 'insurance-metrics-panel'

/**
 * Insurance rules ▸ Metrics — `/insurance-rules/metrics` (BackOffice spec 3126, door 3141, oms ticket 615).
 * Three tabs on one local window (`?from&to`, the last 30 days by default):
 * - **Metrics** per rule, store, pharmacist or day — fires by severity, shadow fires, outcome mix, override rate,
 *   SAR protected (an ESTIMATE, labelled so), rejections after a pass, time added at the till;
 * - **Flags** — noisy, silent, jump, each with the numbers that raised it (a flag never pauses a rule);
 * - **Rejections** — the payers' rejections by code (or words), payer and same kind, ranked by SAR, marking
 *   where a live guard already covers the kind.
 * The address is the state (`useUrlQuery`). Read-only.
 *
 * 🚩 UNGATED: no access probe until 618; a bare 403 on a read is "You do not have access".
 */
export default function MetricsPage() {
  const { t } = useTranslation('insurance-metrics')
  const { query, update } = useUrlQuery(metricsFromParams, metricsToParams)
  const problem = windowOf(query)
  const set = (patch: Partial<MetricsQuery>) => update((q) => ({ ...q, ...patch }))

  return (
    <section className="flex w-full flex-col gap-4" data-metrics-page="">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        </div>
        <fieldset className="flex flex-wrap items-end gap-2" data-window="">
          <legend className="sr-only">{t('window.label')}</legend>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('window.from')}
            <input type="date" value={query.from} onChange={(e) => e.target.value && set({ from: e.target.value })} className={INPUT} data-window-from="" />
          </label>
          <label className="flex flex-col gap-1 text-xs text-muted-foreground">
            {t('window.to')}
            <input type="date" value={query.to} onChange={(e) => e.target.value && set({ to: e.target.value })} className={INPUT} data-window-to="" />
          </label>
        </fieldset>
      </header>

      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1 border-b border-border/60" data-metrics-tabs="">
        {METRICS_TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            role="tab"
            aria-selected={query.tab === tab}
            aria-controls={PANEL_ID}
            onClick={() => set({ tab })}
            className={`-mb-px border-b-2 px-3 py-1.5 text-sm ${query.tab === tab ? 'border-primary font-medium text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'}`}
            data-tab={tab}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div id={PANEL_ID} role="tabpanel" className="flex min-w-0 flex-col gap-4">
        {problem && query.tab !== 'flags' ? (
          <p className="rounded-md border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" role="alert" data-window-problem={problem}>
            {t(`window.${problem}`)}
          </p>
        ) : query.tab === 'metrics' ? (
          <MetricsTab query={query} onBy={(by) => set({ by })} />
        ) : query.tab === 'flags' ? (
          <FlagsTab />
        ) : (
          <RejectionsTab query={query} onPayer={(payer) => set({ payer })} />
        )}
      </div>
    </section>
  )
}
