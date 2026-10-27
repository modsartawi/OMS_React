import { useTranslation } from 'react-i18next'
import Chip from '@/core/ui/Chip'
import { useUrlQuery } from '@/core/ui/use-url-query'
import FlagsTab from './FlagsTab'
import MetricsTab from './MetricsTab'
import { METRICS_TABS, metricsFromParams, metricsToParams, windowOf, type MetricsQuery } from './query'
import RejectionsTab from './RejectionsTab'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

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
          <Field label={t('window.from')}>
            <Input type="date" value={query.from} onChange={(e) => e.target.value && set({ from: e.target.value })} data-window-from="" />
          </Field>
          <Field label={t('window.to')}>
            <Input type="date" value={query.to} onChange={(e) => e.target.value && set({ to: e.target.value })} data-window-to="" />
          </Field>
        </fieldset>
      </header>

      <div role="tablist" aria-label={t('tabs.label')} className="flex gap-1" data-metrics-tabs="">
        {METRICS_TABS.map((tab) => (
          <Chip key={tab} variant="tab" on={query.tab === tab} aria-controls={PANEL_ID} onClick={() => set({ tab })} data-tab={tab}>
            {t(`tabs.${tab}`)}
          </Chip>
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
