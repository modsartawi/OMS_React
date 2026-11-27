import { Fragment, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight, FlaskConical, Loader2, Stamp } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { WeightSetListItem, WeightSetVersionRef } from '@/core/models/sourcing-run'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { setsQuery } from './api'
import { CARD, NS } from './parts'
import VersionDiff from './VersionDiff'
import { comparedPair, pickToCompare } from './version-diff-model'

/**
 * The list of sets and versions (ticket 967, the owner's variant A): a table of sets — owner, note, how many versions,
 * which one is the candidate set, retired / trial set / baseline — whose rows open onto their versions (who saved it,
 * when, the line saying what changed). Ticking two versions shows what differs under the table. Under the marking grant
 * a version that may be offered carries "Mark…", which opens the marking screen on it.
 */
export default function SetsList({ canMark, onMark }: { canMark: boolean; onMark: (ref: WeightSetVersionRef) => void }) {
  const { t } = useTranslation(NS)
  const sets = useQuery(setsQuery())
  const [open, setOpen] = useState<string[] | null>(null)
  const [picked, setPicked] = useState<WeightSetVersionRef[]>([])

  if (sets.isError) return <ErrorBanner title={t('list.failedTitle')} message={apiErrorMessage(sets.error, t('list.failed'))} />
  if (!sets.data)
    return (
      <p className="inline-flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('list.loading')}
      </p>
    )

  // The set holding the candidate set opens first.
  const opened = open ?? sets.data.filter((s) => s.versions.some((v) => v.candidate)).map((s) => s.name)
  const toggle = (name: string) => setOpen(opened.includes(name) ? opened.filter((n) => n !== name) : [...opened, name])
  const pair = comparedPair(picked)

  return (
    <div className="flex flex-col gap-4">
      {sets.data.length === 0 ? (
        <p className={`${CARD} text-sm text-muted-foreground`}>{t('list.empty')}</p>
      ) : (
        <div className={`${CARD} overflow-x-auto p-0`}>
          <table className="w-full text-xs" data-sets="">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{t('list.cols.set')}</th>
                <th className={TH}>{t('list.cols.owner')}</th>
                <th className={TH}>{t('list.cols.note')}</th>
                <th className={`${TH} text-end`}>{t('list.cols.versions')}</th>
                <th className={TH}>{t('list.cols.candidate')}</th>
                <th className={TH}>{t('list.cols.state')}</th>
                <th className={TH}>
                  <span className="sr-only">{t('list.cols.actions')}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {sets.data.map((s) => (
                <SetRows
                  key={s.name}
                  set={s}
                  isOpen={opened.includes(s.name)}
                  onToggle={() => toggle(s.name)}
                  picked={picked}
                  onPick={(ref) => setPicked((p) => pickToCompare(p, ref))}
                  canMark={canMark}
                  onMark={onMark}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
      <VersionDiff pair={pair} />
    </div>
  )
}

function SetRows({
  set: s,
  isOpen,
  onToggle,
  picked,
  onPick,
  canMark,
  onMark,
}: {
  set: WeightSetListItem
  isOpen: boolean
  onToggle: () => void
  picked: readonly WeightSetVersionRef[]
  onPick: (ref: WeightSetVersionRef) => void
  canMark: boolean
  onMark: (ref: WeightSetVersionRef) => void
}) {
  const { t } = useTranslation(NS)
  const candidate = s.versions.find((v) => v.candidate)
  const trial = s.versions.some((v) => v.trial)
  return (
    <Fragment>
      <tr className={`border-b border-border ${s.retired ? 'text-muted-foreground' : ''}`} data-set={s.name} data-retired={s.retired ? '' : undefined}>
        <td className={TD}>
          <Button variant="text" onClick={onToggle} aria-expanded={isOpen} data-set-toggle={s.name}>
            {isOpen ? <ChevronDown className="h-3.5 w-3.5" aria-hidden /> : <ChevronRight className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />}
            <bdi className="font-semibold">{s.name}</bdi>
          </Button>
        </td>
        <td className={TD}>{s.owner ? <Ltr>{s.owner}</Ltr> : <span className="text-muted-foreground">{t('list.nobody')}</span>}</td>
        <td className={`${TD} max-w-[28rem] whitespace-normal`}>{s.note && <bdi>{s.note}</bdi>}</td>
        <td className={`${TD} text-end`}>
          <Ltr>{s.versions.length}</Ltr>
        </td>
        <td className={TD} data-candidate-cell="">
          {candidate && <StatusBadge sev="go">{t('list.candidateVersion', { version: fsi(candidate.version) })}</StatusBadge>}
        </td>
        <td className={TD}>
          <span className="inline-flex flex-wrap gap-1">
            {s.retired && (
              <span data-state="retired">
                <StatusBadge sev="mute">{t('list.retired')}</StatusBadge>
              </span>
            )}
            {trial && (
              <span data-state="trial">
                <StatusBadge sev="warn">
                  <FlaskConical className="me-1 h-3 w-3" aria-hidden />
                  {t('list.trialSet')}
                </StatusBadge>
              </span>
            )}
            {s.baseline && (
              <span data-state="baseline">
                <StatusBadge sev="mute">{t('list.baseline')}</StatusBadge>
              </span>
            )}
          </span>
        </td>
        <td className={TD} />
      </tr>
      {isOpen && (
        <>
          {s.retired && (
            <tr className="border-b border-border bg-muted/40">
              <td className={`${TD} ps-8 whitespace-normal text-muted-foreground`} colSpan={7} data-retired-note="">
                {s.retiredBy && s.retiredAt
                  ? t('list.retiredBy', { by: fsi(s.retiredBy), at: fsi(s.retiredAt) })
                  : t('list.retiredNote')}
              </td>
            </tr>
          )}
          {[...s.versions].reverse().map((row) => {
            const version = row.version
            const ref = { name: s.name, version }
            const isPicked = picked.some((p) => p.name === s.name && p.version === version)
            const isCandidate = row.candidate
            const markable = canMark && !isCandidate && !s.retired && !row.trial
            return (
              <tr key={version} className="border-b border-border bg-muted/40" data-version={`${s.name}|${version}`}>
                <td className={`${TD} ps-8`}>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={isPicked} onChange={() => onPick(ref)} data-pick={`${s.name}|${version}`} />
                    <span>{t('list.version', { version: fsi(version) })}</span>
                  </label>
                </td>
                <td className={TD}>{row.savedBy ? <Ltr>{row.savedBy}</Ltr> : <span className="text-muted-foreground">{t('list.seed')}</span>}</td>
                <td className={`${TD} whitespace-normal`}>{row.change && <bdi>{row.change}</bdi>}</td>
                <td className={`${TD} text-end`}>
                  <Ltr>{row.savedAt}</Ltr>
                </td>
                <td className={TD}>
                  {isCandidate && (
                    <span data-is-candidate="">
                      <StatusBadge sev="go">{t('list.isCandidate')}</StatusBadge>
                    </span>
                  )}
                </td>
                <td className={TD}>
                  {row.trial && (
                    <span data-state="trial">
                      <StatusBadge sev="warn">{t('list.trialSet')}</StatusBadge>
                    </span>
                  )}
                </td>
                <td className={`${TD} text-end`}>
                  {markable && (
                    <Button variant="outlined" onClick={() => onMark(ref)} data-mark-version={`${s.name}|${version}`}>
                      <Stamp className="h-3.5 w-3.5" aria-hidden />
                      {t('list.mark')}
                    </Button>
                  )}
                </td>
              </tr>
            )
          })}
        </>
      )}
    </Fragment>
  )
}
