import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { assignmentOptionsQuery } from './api'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
  defaultSelection,
  resolvedKinds,
  servedByGroups,
  type ServedByKind,
  type ServedByScreen,
  type ServedBySelection,
} from './served-by'

/**
 * The shared **Served by** control (BackOffice spec 1162, tracer 1163) — ONE
 * component for all four collection screens, so a finance user learns one control
 * rather than four.
 *
 * It is deliberately thin: which groups it offers and what a selection puts on the
 * wire both live in the pure `served-by.ts` beside it, which is where the whole
 * per-screen contract is written down as one table and tested. This file is the
 * render glue.
 *
 * ⚠️ **The selection is a PAIR** — a Kind and an id — not one scalar. The same
 * person can be pickable twice (as somebody who serves branches, and as somebody
 * who supervises), and only the Kind tells those two picks apart. The option values
 * below are therefore `KIND:id`, split on the way out.
 *
 * 🚩 **The options payload is fetched once and cached across all four screens** —
 * ONE cache key, no `?screen=` parameter, because the server returns all three
 * groups and the per-screen ruling is applied here.
 */
export interface ServedByPickerProps {
  screen: ServedByScreen
  value: ServedBySelection
  onChange: (selection: ServedBySelection) => void
  disabled?: boolean
}

/** The separator between the Kind and the id in an <option> value. Staff ids are
 *  numeric and Kinds are upper-case words, so a colon cannot appear in either. */
const SEP = ':'

export default function ServedByPicker({
  screen,
  value,
  onChange,
  disabled = false,
}: ServedByPickerProps) {
  const { t } = useTranslation('collection')

  // The one shared key+options (in `api.ts`, beside the access probe's), so a user
  // moving between the four screens costs one request and not four — and so the
  // page that lands on `defaultScope` reads the very same cache entry this picker
  // renders from, rather than a second copy that could disagree with it.
  const { data, isPending } = useQuery(assignmentOptionsQuery())

  // The per-screen contract decides which groups belong here; the screen's own
  // resolved list then drops any Kind its READING cannot answer yet. Both are data —
  // which is why 1164 turned three Kinds on without touching this component, and why
  // 1167/1168 will turn on the collected-by arms the same way.
  const resolved = resolvedKinds(screen)
  const groups = servedByGroups(screen, data).filter((group) => resolved.includes(group.kind))
  const offersUnassigned = resolved.includes(SERVED_BY_KINDS.unassigned)
  const selected = value.kind === '' ? '' : `${value.kind}${SEP}${value.id}`

  // The caller's own landing scope (1165) — their branches AND their reports'. It is
  // rendered as a first-class option, above everything else, because the screen
  // OPENS on it: a selection the control could not display would be a grid claiming
  // a scope with a blank filter box beside it. `defaultSelection` re-checks the
  // screen's reading, so a screen whose arms are unbuilt never offers it.
  const mine = defaultSelection(screen, data)
  const mineName = (data?.defaultScope?.displayName ?? '').trim()

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t('servedBy.label')}
      <select
        disabled={disabled}
        value={selected}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === '') {
            onChange(NO_SERVED_BY)
            return
          }
          const cut = raw.indexOf(SEP)
          const kind = raw.slice(0, cut) as ServedByKind
          onChange({ kind, id: raw.slice(cut + 1) })
        }}
        className="h-9 w-56 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
      >
        {/* Nothing picked is the estate, and it is always reachable — the scope is a
            finding aid, never a permission. Anyone who can open this screen may look
            at any branch, and the widen control is never locked. */}
        <option value="">{isPending ? t('servedBy.loading') : t('servedBy.all')}</option>

        {/* 🚩 The landing scope, FIRST and outside the groups — it is a question
            about the person looking, not one of the roster's people to pick. It sits
            beside "Everyone" rather than replacing it: widening is always one click
            and never refused, because this is a finding aid and not a permission. */}
        {mine.kind !== '' && (
          <option value={`${mine.kind}${SEP}${mine.id}`} title={t('servedBy.mineHint')}>
            {/* ⚠️ Name-less when the caller is on no roster row of their own — somebody's
                supervisor and nothing else. The roster's `DisplayName` is the only place
                these people's names live, so there is nothing to fall back to, and a bare
                staff id in the caption ("My branches — 15493") reads as a bug. */}
            {mineName === '' ? t('servedBy.mineNoName') : t('servedBy.mine', { name: mineName })}
          </option>
        )}

        {groups.map((group) => (
          <optgroup key={group.kind} label={t(`servedBy.groups.${group.kind}`)}>
            {group.people.map((person) => (
              <option key={`${group.kind}${SEP}${person.staffId}`} value={`${group.kind}${SEP}${person.staffId}`}>
                {person.displayName}
              </option>
            ))}
          </optgroup>
        ))}

        {/* 🚩 *Unassigned* sits OUTSIDE the groups and LAST, because it names nobody:
            it is a question about branches, not a person to pick. On this screen it
            means "either slot empty, or no pairing row at all" — the ~1255 branches
            the finance sheet never covered. Keeping the gap pickable is the whole
            reason it does not silently vanish from every scoped view.

            Its value carries the SEP with an empty id, so the split above yields
            { kind: 'UNASSIGNED', id: '' } — the exact pair buildServedByParams turns
            into a lone ServedByKind. */}
        {offersUnassigned && (
          <option value={`${SERVED_BY_KINDS.unassigned}${SEP}`} title={t('servedBy.unassignedHint')}>
            {t('servedBy.unassigned')}
          </option>
        )}
      </select>
    </label>
  )
}
