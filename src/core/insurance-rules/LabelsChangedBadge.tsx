import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { INSURANCE_RULES_PATH } from './model'
import { repinAffectedQuery } from './registry-api'

/** A ruleset's labels-only draft (`?repin=`), or the re-pin list when none is raised yet. */
export const labelsDraftPath = (draftId: string | null): string =>
  `${INSURANCE_RULES_PATH}/aliases${draftId ? `?repin=${encodeURIComponent(draftId)}` : ''}`

/**
 * The labels-changed badge on a published ruleset itself (oms 708; door 3297): its text is pinned to an older label version
 * until a draft is approved. It opens that draft. `rulesets` are the door's `rulesetId`s this screen shows (🚩 guessed: `guards`,
 * `monitors`, `coverage`, `category`; 711 reconciles). A denied or failed read shows no badge, as a drift badge does.
 */
export function LabelsChangedBadge({ rulesets, newTab }: { rulesets: readonly string[]; newTab?: boolean }) {
  const { t } = useTranslation('insurance-rules')
  const rows = useQuery(repinAffectedQuery()).data ?? []
  return (
    <>
      {rows
        .filter((r) => r.kind === 'labels' && rulesets.includes(r.rulesetId))
        .map((r) => (
          <Link
            key={r.rulesetId}
            to={labelsDraftPath(r.draftId)}
            target={newTab ? '_blank' : undefined}
            rel={newTab ? 'noopener' : undefined}
            className="inline-flex hover:underline"
            title={t('labelsChanged.hint', { name: fsi(r.rulesetName), version: fsi(String(r.rulesetVersion)) })}
            data-labels-changed-badge={r.rulesetId}
          >
            <StatusBadge sev="warn">{t('labelsChanged.badge')}</StatusBadge>
          </Link>
        ))}
    </>
  )
}
