import { useTranslation } from 'react-i18next'
import type { AnalyticsCatalogPlanned, AnalyticsPlannedStatus } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import type { PlannedSource } from './catalog-planned'
import { BothOrNone, DetailShell, Fact, ServerText } from './CatalogDetailParts'

/** A roadmap status's badge tone: neutral idea, then go, under way, done. */
const STATUS_SEV: Record<AnalyticsPlannedStatus, Severity> = { idea: 'mute', approved: 'go', building: 'warn', live: 'ok' }

export function PlannedStatusBadge({ status }: { status: AnalyticsPlannedStatus }) {
  const { t } = useTranslation('boards')
  return (
    <span data-catalog-planned-status={status}>
      <StatusBadge sev={STATUS_SEV[status]}>{t(`catalog.planned.status.${status}`)}</StatusBadge>
    </span>
  )
}

/**
 * A planned area's detail (ticket 842, spec 3437 stories 31–32): its status, the questions it would answer, and the
 * source tables it would use — each marked as already read by a mart, untapped (with its note), or unknown.
 */
export default function CatalogPlannedDetail({ planned, sources }: { planned: AnalyticsCatalogPlanned; sources: PlannedSource[] }) {
  const { t } = useTranslation('boards')
  return (
    <DetailShell kind={t('catalog.planned.kind')} title={planned.label} machineKey={planned.key} actions={null} data="planned">
      <Fact label={t('catalog.planned.statusLabel')} data="status">
        <PlannedStatusBadge status={planned.status} />
      </Fact>
      <Fact label={t('catalog.planned.questions')} data="questions">
        {planned.questions.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.notGiven')}</span>
        ) : (
          <ul className="flex list-disc flex-col gap-1.5 ps-4" data-catalog-questions>
            {planned.questions.map((q, i) => (
              <li key={i}>
                <BothOrNone says={q} />
              </li>
            ))}
          </ul>
        )}
      </Fact>
      <Fact label={t('catalog.fact.sources')} data="sources">
        {sources.length === 0 ? (
          <span className="text-muted-foreground">{t('catalog.noSources')}</span>
        ) : (
          <ul className="flex flex-col gap-2" data-catalog-planned-sources>
            {sources.map((s) => (
              <li key={s.key} className="flex flex-col gap-0.5" data-catalog-planned-source={s.key} data-catalog-source-kind={s.kind}>
                <span className="flex flex-wrap items-center gap-2">
                  <Ltr>{s.key}</Ltr>
                  <StatusBadge sev={s.kind === 'unknown' ? 'warn' : 'mute'}>{t(`catalog.planned.sourceKind.${s.kind}`)}</StatusBadge>
                </span>
                {s.kind === 'untapped' && s.untapped.note && (
                  <span className="text-xs text-muted-foreground">
                    <ServerText text={s.untapped.note} />
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Fact>
    </DetailShell>
  )
}
