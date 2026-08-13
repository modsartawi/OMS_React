import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { collectionApi } from './api'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
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

/**
 * The one cache key every screen's picker shares, so a user moving between the four
 * screens costs one request and not four. Spelled once for the same reason
 * `COLLECTION_ACCESS_KEY` is: a typo in a literal would not fail a build, it would
 * silently split the cache entry.
 */
export const ASSIGNMENT_OPTIONS_KEY = ['collection', 'assignment-options'] as const

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

  const { data, isPending } = useQuery({
    queryKey: ASSIGNMENT_OPTIONS_KEY,
    queryFn: () => collectionApi.assignmentOptions(),
    // The roster does not change inside a page life, and an unreachable sink is the
    // same failure class the grid beside it already shows on a read: the picker is
    // simply empty. No retry storm over a filter.
    staleTime: Infinity,
    retry: false,
  })

  // The per-screen contract decides which groups belong here; the screen's own
  // resolved list then drops any Kind its READING cannot answer yet. Both are data —
  // which is why 1164 turned three Kinds on without touching this component, and why
  // 1167/1168 will turn on the collected-by arms the same way.
  const resolved = resolvedKinds(screen)
  const groups = servedByGroups(screen, data).filter((group) => resolved.includes(group.kind))
  const offersUnassigned = resolved.includes(SERVED_BY_KINDS.unassigned)
  const selected = value.kind === '' ? '' : `${value.kind}${SEP}${value.id}`

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
