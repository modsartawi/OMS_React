import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import type { AnalyticsAudienceRole, AnalyticsAudienceUser } from '@/core/models/analytics'
import { saysIn } from '@/core/rules/sentence'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import { formatPair } from '@/core/util/bidi'
import type { AudienceDraft } from './audience'
import { useCandidates } from './use-candidates'

/** A role reads by its words; a removed one is flagged (§C: kept, marked, granting nobody). */
export function roleOption(r: AnalyticsAudienceRole, removedNote: string): MultiSelectOption {
  return { value: r.key, text: saysIn(r.label, i18n.language) || r.key, tone: r.removed ? 'danger' : 'default', note: r.removed ? removedNote : undefined }
}
/** A user reads as `employee id · name`, one pair led by a machine value (`Ltr` once, `.claude/rules/bidi.md`). */
export const userOption = (u: AnalyticsAudienceUser): MultiSelectOption => ({ value: u.id, text: formatPair(u.employeeId || u.id, u.name), machine: true })

/**
 * The audience picker (spec 819 §E, ticket 826; graduated at oms 925 for the item lists, spec 4057): "Everyone", or
 * a mix of authz roles and named users picked through `AudienceCandidates` (search by name or employee id). A
 * removed role is marked.
 *
 * `closed` picks only among the seed (a curator narrowing a chosen audience: no search, nothing to add);
 * `everyoneLocked` keeps "Everyone" from being chosen (narrowing never widens).
 */
export default function AudiencePicker({
  who,
  draft,
  onChange,
  seed = { roles: [], users: [] },
  closed = false,
  everyoneLocked = false,
}: {
  /** The caller's words over the two chips ("Who can run it", "Who can read it"). */
  who: ReactNode
  draft: AudienceDraft
  onChange: (next: AudienceDraft) => void
  seed?: { roles: AnalyticsAudienceRole[]; users: AnalyticsAudienceUser[] }
  closed?: boolean
  everyoneLocked?: boolean
}) {
  const { t } = useTranslation('common')
  const candidates = useCandidates(seed, !closed)
  const removedNote = t('audience.removedRole')

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

  return (
    <>
      <div className="flex flex-col gap-1.5">
        <span className="text-sm font-medium">{who}</span>
        <div className="flex gap-1">
          <Chip on={draft.everyone} onClick={() => onChange({ ...draft, everyone: true })} disabled={everyoneLocked} data-analytics-share-everyone>
            {t('audience.everyone')}
          </Chip>
          <Chip on={!draft.everyone} onClick={() => onChange({ ...draft, everyone: false })} data-analytics-share-chosen>
            {t('audience.chosen')}
          </Chip>
        </div>
      </div>
      {!draft.everyone && (
        <>
          <Field label={t('audience.roles')} hint={t('audience.rolesHint')}>
            <MultiSelect
              value={draft.roles}
              onChange={(roles) => onChange({ ...draft, roles })}
              options={roleOptions}
              optionOf={roleOf}
              label={t('audience.roles')}
              loading={!closed && candidates.loading}
              failed={!closed && candidates.failed}
              onQueryChange={closed ? undefined : candidates.setTyped}
              data-testid="analytics-share-roles"
            />
          </Field>
          <Field label={t('audience.people')} hint={t('audience.peopleHint')}>
            <MultiSelect
              value={draft.users}
              onChange={(users) => onChange({ ...draft, users })}
              options={userOptions}
              optionOf={userOf}
              label={t('audience.people')}
              loading={!closed && candidates.loading}
              failed={!closed && candidates.failed}
              onQueryChange={closed ? undefined : candidates.setTyped}
              data-testid="analytics-share-users"
            />
          </Field>
        </>
      )}
    </>
  )
}
