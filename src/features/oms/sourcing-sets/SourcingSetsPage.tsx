import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import { usePermissions } from '@/core/permissions'
import { canMarkCandidateSet, canOpenWeightSets } from '@/core/sourcing-advisor/access'
import Chip from '@/core/ui/Chip'
import ScreenGate from '@/core/ui/ScreenGate'
import CandidateLog from './CandidateLog'
import MarkingForm from './MarkingForm'
import { NS } from './parts'
import SetsList from './SetsList'

type Tab = 'list' | 'log' | 'mark'

/**
 * Weight sets (ticket 967, BackOffice spec 4354 §10, §18 and §19 "the list of weight sets and versions, with the
 * candidate log and the marking screen"), built as the owner's variant A of the prototype: sets that open onto their
 * versions in a table, with what differs between two ticked versions; the candidate log as rows; marking as one long
 * form under the marking grant.
 *
 * Open to the simulator's run grant, which reads the list, a version and the candidate log (`canOpenWeightSets`; BO
 * 4360); the marking tab to the mark grant. The tab and the version being marked live in the URL
 * (`?tab=mark&set=…&version=…`). Doors: BO 4360 / 4395 `WeightSetEndpoints`, reconciled at pricing2 35a4e56be (`./api`).
 */
export default function SourcingSetsPage() {
  const { t } = useTranslation(NS)
  return (
    <ScreenGate can={canOpenWeightSets} ns={NS} title={t('title')} subtitle={t('subtitle')}>
      <Screens />
    </ScreenGate>
  )
}

function Screens() {
  const { t } = useTranslation(NS)
  const canMark = canMarkCandidateSet(usePermissions())
  const [params, setParams] = useSearchParams()
  const asked = params.get('tab')
  const tab: Tab = asked === 'log' ? 'log' : asked === 'mark' && canMark ? 'mark' : 'list'
  const version = Number(params.get('version'))
  const target: WeightSetVersionRef | null = params.get('set') && Number.isInteger(version) && version > 0 ? { name: params.get('set')!, version } : null

  const go = (next: Tab, ref?: WeightSetVersionRef | null) =>
    setParams(
      () => {
        const n = new URLSearchParams()
        if (next !== 'list') n.set('tab', next)
        const r = ref === undefined ? (next === 'mark' ? target : null) : ref
        if (next === 'mark' && r) {
          n.set('set', r.name)
          n.set('version', String(r.version))
        }
        return n
      },
      { replace: ref === undefined },
    )

  const tabs: Tab[] = canMark ? ['list', 'log', 'mark'] : ['list', 'log']

  return (
    <section className="flex w-full max-w-7xl min-w-0 flex-col gap-4" data-sourcing-sets="" data-tab={tab}>
      <div role="tablist" aria-label={t('tabs.label')} className="flex flex-wrap gap-1.5">
        {tabs.map((k) => (
          <Chip key={k} variant="tab" on={tab === k} onClick={() => go(k)} data-sets-tab={k}>
            {t(`tabs.${k}`)}
          </Chip>
        ))}
      </div>
      {asked === 'mark' && !canMark && (
        <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-mark-needs-grant="">
          {t('mark.needsGrant')}
        </p>
      )}
      <div role="tabpanel">
        {tab === 'list' && <SetsList canMark={canMark} onMark={(ref) => go('mark', ref)} />}
        {tab === 'log' && <CandidateLog />}
        {tab === 'mark' && <MarkingForm target={target} onPick={(ref) => go('mark', ref)} />}
      </div>
    </section>
  )
}
