import { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Lock, ShieldAlert, Users } from 'lucide-react'
import i18n from '@/core/i18n'
import type { AnalyticsAudienceRole, AnalyticsAudienceUser, AnalyticsAudienceWrite, AnalyticsBoard, AnalyticsItem } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Modal from '@/core/ui/Modal'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import { formatPair, fsi } from '@/core/util/bidi'
import { analyticsApi, analyticsAudienceCandidatesKey } from './api'
import { audienceDraft, audienceWrite, isNarrowing, type AudienceDraft } from './audience'
import { analyticsRefusal, refusalWords } from './wire'

/**
 * `GET Analytics/AudienceCandidates` for what is typed (debounced, like the strip's member picker). Every role and
 * user seen is remembered (`seen`), so a chosen one keeps its words after a search that no longer lists it.
 */
export function useCandidates(seed: { roles: AnalyticsAudienceRole[]; users: AnalyticsAudienceUser[] }, enabled = true, reportId?: string) {
  const [typed, setTyped] = useState('')
  const [search, setSearch] = useState('')
  useEffect(() => {
    const id = setTimeout(() => setSearch(typed.trim()), 250)
    return () => clearTimeout(id)
  }, [typed])
  const query = useQuery({
    // 833: the schedule editor asks for one report's candidates (with their address, run grant and audience).
    queryKey: analyticsAudienceCandidatesKey(search, reportId),
    queryFn: () => analyticsApi.audienceCandidates(search, reportId),
    placeholderData: keepPreviousData,
    staleTime: 60_000,
    retry: false,
    enabled,
  })
  const seen = useRef({ roles: new Map(seed.roles.map((r) => [r.key, r])), users: new Map(seed.users.map((u) => [u.id, u])) })
  for (const r of query.data?.roles ?? []) seen.current.roles.set(r.key, r)
  for (const u of query.data?.users ?? []) seen.current.users.set(u.id, u)
  return { data: query.data, loading: query.isFetching, failed: !!query.error, setTyped, seen: seen.current }
}

/** A role reads by its words; a removed one is flagged (§C: kept, marked, granting nobody). */
function roleOption(r: AnalyticsAudienceRole, removedNote: string): MultiSelectOption {
  return { value: r.key, text: saysIn(r.label, i18n.language) || r.key, tone: r.removed ? 'danger' : 'default', note: r.removed ? removedNote : undefined }
}
/** A user reads as `employee id · name`, one pair led by a machine value (`Ltr` once, `.claude/rules/bidi.md`). */
const userOption = (u: AnalyticsAudienceUser): MultiSelectOption => ({ value: u.id, text: formatPair(u.employeeId || u.id, u.name), machine: true })

const audienceSeed = (item: AnalyticsItem | AnalyticsBoard) =>
  item.audience && !item.audience.everyone ? { roles: item.audience.roles, users: item.audience.users } : { roles: [], users: [] }

/**
 * The share dialog (spec 819 §E, ticket 826): "Everyone", or a mix of authz roles and named users picked through
 * `AudienceCandidates` (search by name or employee id). A removed role is marked.
 *
 * - `share` (the owner): a Personal item is shared with what is chosen (`…/Share` with the audience); a Shared one's
 *   audience changes (`…/Audience`, written to the history, never `ANALYTICS-405`).
 * - `narrow` (a curator, not the owner): the same dialog, offering only a narrower audience — from everyone to any
 *   choice, or from a choice to a part of it — and Unshare.
 */
export default function ShareDialog({
  item,
  mode,
  pending,
  error,
  onClose,
  onSave,
  onUnshare,
}: {
  item: AnalyticsItem | AnalyticsBoard
  mode: 'share' | 'narrow'
  pending: boolean
  error: unknown
  onClose: () => void
  onSave: (audience: AnalyticsAudienceWrite) => void
  onUnshare?: () => void
}) {
  const { t } = useTranslation('boards')
  const before = audienceDraft(item.tier === 'shared' ? (item.audience ?? { everyone: true }) : null)
  const [draft, setDraft] = useState<AudienceDraft>(before)
  // A curator narrowing a chosen audience picks only among what it holds: no search, nothing to add.
  const closed = mode === 'narrow' && !before.everyone
  const seed = audienceSeed(item)
  const candidates = useCandidates(seed, !closed)
  const removedNote = t('share.removedRole')

  const roleOptions = (closed ? seed.roles : (candidates.data?.roles ?? [])).map((r) => roleOption(r, removedNote))
  const userOptions = (closed ? seed.users : (candidates.data?.users ?? [])).map(userOption)
  const roleOf = (key: string) => {
    const r = candidates.seen.roles.get(key)
    return r ? roleOption(r, removedNote) : { value: key, text: key, tone: 'danger' as const }
  }
  const userOf = (id: string) => {
    const u = candidates.seen.users.get(id)
    return u ? userOption(u) : { value: id, text: id, machine: true }
  }

  const write = audienceWrite(draft)
  const changed = JSON.stringify(write) !== JSON.stringify(audienceWrite(before))
  const valid = mode === 'narrow' ? isNarrowing(before, draft) : !!write && (item.tier === 'personal' || changed)
  const refused = error ? refusalWords(analyticsRefusal(error, t('tierActions.failed')), t) : null
  const title = saysIn(item.title, i18n.language)

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!pending}
      title={title ? t(`share.title.${mode}`, { title: fsi(title) }) : t(`share.untitled.${mode}.${item.kind}`)}
      width="38rem"
      footer={
        <>
          {mode === 'narrow' && onUnshare && (
            <Button variant="danger-outlined" className="me-auto" onClick={onUnshare} disabled={pending} data-analytics-share-unshare>
              <Lock className="size-3.5" aria-hidden />
              {t('tierActions.unshare')}
            </Button>
          )}
          <Button variant="text" onClick={onClose} disabled={pending}>
            {t('share.cancel')}
          </Button>
          <Button onClick={() => write && onSave(write)} disabled={!valid || pending} data-analytics-share-save>
            {t(`share.save.${mode === 'narrow' ? 'narrow' : item.tier === 'personal' ? 'share' : 'audience'}`)}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-analytics-share={mode}>
        {mode === 'narrow' && <p className="text-sm text-muted-foreground">{t('share.narrowHint')}</p>}
        <div className="flex flex-col gap-1.5">
          <span className="text-sm font-medium">{t('share.who')}</span>
          <div className="flex gap-1">
            <Chip
              on={draft.everyone}
              onClick={() => setDraft({ ...draft, everyone: true })}
              disabled={mode === 'narrow'}
              data-analytics-share-everyone
            >
              {t('share.everyone')}
            </Chip>
            <Chip on={!draft.everyone} onClick={() => setDraft({ ...draft, everyone: false })} data-analytics-share-chosen>
              {t('share.chosen')}
            </Chip>
          </div>
        </div>
        {!draft.everyone && (
          <>
            <Field label={t('share.roles')} hint={t('share.rolesHint')}>
              <MultiSelect
                value={draft.roles}
                onChange={(roles) => setDraft({ ...draft, roles })}
                options={roleOptions}
                optionOf={roleOf}
                label={t('share.roles')}
                loading={!closed && candidates.loading}
                failed={!closed && candidates.failed}
                onQueryChange={closed ? undefined : candidates.setTyped}
                data-testid="analytics-share-roles"
              />
            </Field>
            <Field label={t('share.people')} hint={t('share.peopleHint')}>
              <MultiSelect
                value={draft.users}
                onChange={(users) => setDraft({ ...draft, users })}
                options={userOptions}
                optionOf={userOf}
                label={t('share.people')}
                loading={!closed && candidates.loading}
                failed={!closed && candidates.failed}
                onQueryChange={closed ? undefined : candidates.setTyped}
                data-testid="analytics-share-users"
              />
            </Field>
          </>
        )}
        <div className="grid grid-cols-2 gap-3 rounded-md bg-muted/50 p-3 text-xs">
          <div>
            <p className="mb-1 flex items-center gap-1 font-medium">
              <Users className="size-3.5" aria-hidden />
              {t('share.canTitle')}
            </p>
            <ul className="list-disc ps-4 text-muted-foreground">
              {(['run', 'params', 'export', 'link'] as const).map((k) => (
                <li key={k}>{t(`share.can.${k}`)}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="mb-1 flex items-center gap-1 font-medium">
              <Lock className="size-3.5" aria-hidden />
              {t('share.cannotTitle')}
            </p>
            <ul className="list-disc ps-4 text-muted-foreground">
              {(['edit', 'ai', 'copy'] as const).map((k) => (
                <li key={k}>{t(`share.cannot.${k}`)}</li>
              ))}
            </ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t('share.history')}</p>
        {refused && (
          <p className="flex items-start gap-1 text-xs text-attention-800" role="alert" data-analytics-share-refusal>
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <bdi>{refused}</bdi>
          </p>
        )}
      </div>
    </Modal>
  )
}

/**
 * The curator's reassign (spec 819 §C, ticket 826): hand the item to another author, picked through
 * `AudienceCandidates` (users only). Its audience and tier are kept; the new owner must hold author, which the
 * server judges.
 */
export function ReassignDialog({
  item,
  pending,
  error,
  onClose,
  onSave,
}: {
  item: AnalyticsItem | AnalyticsBoard
  pending: boolean
  error: unknown
  onClose: () => void
  onSave: (owner: string) => void
}) {
  const { t } = useTranslation('boards')
  const [owner, setOwner] = useState<string | null>(null)
  const candidates = useCandidates({ roles: [], users: [] })
  const options = (candidates.data?.users ?? []).filter((u) => u.id.toLowerCase() !== item.owner.toLowerCase()).map(userOption)
  const userOf = (id: string) => {
    const u = candidates.seen.users.get(id)
    return u ? userOption(u) : { value: id, text: id, machine: true }
  }
  const refused = error ? refusalWords(analyticsRefusal(error, t('tierActions.failed')), t) : null
  const title = saysIn(item.title, i18n.language)

  return (
    <Modal
      open
      onClose={onClose}
      dismissable={!pending}
      title={title ? t('reassign.title', { title: fsi(title) }) : t(`reassign.untitled.${item.kind}`)}
      width="32rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={pending}>
            {t('share.cancel')}
          </Button>
          <Button onClick={() => owner && onSave(owner)} disabled={!owner || pending} data-analytics-reassign-save>
            {t('reassign.save')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4" data-analytics-reassign>
        <p className="text-sm text-muted-foreground">{t('reassign.hint', { owner: fsi(item.owner) })}</p>
        <Field label={t('reassign.to')} hint={t('reassign.toHint')}>
          <MultiSelect
            value={owner ? [owner] : []}
            // One owner: the last one ticked replaces the one before.
            onChange={(next) => setOwner(next.length ? next[next.length - 1] : null)}
            options={options}
            optionOf={userOf}
            label={t('reassign.to')}
            loading={candidates.loading}
            failed={candidates.failed}
            onQueryChange={candidates.setTyped}
            data-testid="analytics-reassign-owner"
          />
        </Field>
        {refused && (
          <p className="flex items-start gap-1 text-xs text-attention-800" role="alert" data-analytics-share-refusal>
            <ShieldAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <bdi>{refused}</bdi>
          </p>
        )}
      </div>
    </Modal>
  )
}
