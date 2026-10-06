import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { fsi } from '@/core/util/bidi'
import { assignmentOptionsQuery } from './api'
import {
  NO_SERVED_BY,
  SERVED_BY_KINDS,
  SERVED_BY_SCREENS,
  defaultSelection,
  parseServedByText,
  resolvedKinds,
  servedByEntries,
  servedByGroups,
  servedByText,
  type ServedByEntry,
  type ServedByKind,
  type ServedByScreen,
  type ServedBySelection,
} from './served-by'

/**
 * The shared **Served by** control (BackOffice spec 1162, tracer 1163) — ONE
 * component for all five collection screens, so a finance user learns one control
 * rather than five.
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
 * 🚩 **The options payload is fetched once and cached across all five screens** —
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

/** The option that swaps the dropdown for a typed id. It carries no SEP, so it can
 *  never collide with a `KIND:id` value — nor with `''`, the estate. */
const TYPE_ID = 'TYPE_ID'

const FIELD_CLASS =
  'h-9 w-56 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export default function ServedByPicker({
  screen,
  value,
  onChange,
  disabled = false,
}: ServedByPickerProps) {
  const { t } = useTranslation('collection')
  const contract = SERVED_BY_SCREENS[screen]
  const collected = contract.reading === 'collector'
  const [typing, setTyping] = useState(false)

  // The one shared key+options (in `api.ts`, beside the access probe's), so a user
  // moving between the five screens costs one request and not five — and so the
  // page that lands on `defaultScope` reads the very same cache entry this picker
  // renders from, rather than a second copy that could disagree with it.
  const { data, isPending } = useQuery(assignmentOptionsQuery())

  // The per-screen contract decides which groups belong here; the screen's own
  // resolved list then drops any Kind its READING cannot answer yet. Both are data —
  // which is why 1164 turned three Kinds on without touching this component, and why
  // 1167 turned the collected-by arms on the same way — by editing one array.
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

  // 🚩 **The two collected-by screens accept an id that is on no roster row**
  // (BackOffice 1167) — not a nicety: the roster holds 8 collectors while a shipped
  // ACR carries *whoever collected*, so a strict picker would make an id plainly
  // visible in the grid un-typeable in the filter beside it. Owner ruling
  // 2026-09-27: they still OPEN as the same dropdown Cash Collections has — a text
  // box pre-filled with "My collections" read as a locked field, because a datalist
  // only suggests what matches the text already in it — and typing an id is one
  // pick away, under "Type a collector id…".
  const entries = collected ? servedByEntries(screen, data, (entry) => labelFor(entry, t)) : []
  const offRoster =
    collected &&
    !isPending &&
    value.kind !== '' &&
    !entries.some((entry) => entry.kind === value.kind && entry.id === value.id)

  if (typing) {
    return (
      <ServedByIdInput
        screen={screen}
        entries={entries}
        disabled={disabled}
        onCommit={(selection) => {
          setTyping(false)
          if (selection) onChange(selection)
        }}
      />
    )
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t('servedBy.label')}
      <select
        disabled={disabled}
        value={selected}
        title={collected ? t('servedBy.collected.hint') : undefined}
        onChange={(e) => {
          const raw = e.target.value
          if (raw === TYPE_ID) {
            setTyping(true)
            return
          }
          if (raw === '') {
            onChange(NO_SERVED_BY)
            return
          }
          const cut = raw.indexOf(SEP)
          const kind = raw.slice(0, cut) as ServedByKind
          onChange({ kind, id: raw.slice(cut + 1) })
        }}
        className={FIELD_CLASS}
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
            {mineLabel(collected, mineName, t)}
          </option>
        )}

        {/* A typed id off the roster has no row below, so it is drawn here as itself —
            a selection the control could not display would be a filtered grid beside
            a box claiming "Everyone". */}
        {offRoster && <option value={selected}>{servedByText(value, entries)}</option>}

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
            it is a question about branches, not a person to pick. On the assignment
            screens it means "either slot empty, or no pairing row at all" — the ~1255
            branches the finance sheet never covered; on the collected-by screens,
            collected by somebody finance never enrolled. Keeping the gap pickable is
            the whole reason it does not silently vanish from every scoped view.

            Its value carries the SEP with an empty id, so the split above yields
            { kind: 'UNASSIGNED', id: '' } — the exact pair buildServedByParams turns
            into a lone ServedByKind. */}
        {offersUnassigned && (
          <option
            value={`${SERVED_BY_KINDS.unassigned}${SEP}`}
            title={collected ? undefined : t('servedBy.unassignedHint')}
          >
            {collected ? t('servedBy.collected.unassigned') : t('servedBy.unassigned')}
          </option>
        )}

        {contract.freeText && <option value={TYPE_ID}>{t('servedBy.collected.typeId')}</option>}
      </select>
    </label>
  )
}

function mineLabel(
  collected: boolean,
  name: string,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (collected) {
    return name === '' ? t('servedBy.collected.mineNoName') : t('servedBy.collected.mine', { name })
  }
  return name === '' ? t('servedBy.mineNoName') : t('servedBy.mine', { name })
}

/**
 * The typed-id box the collected-by screens swap in when "Type a collector id…" is
 * picked: `<input list>` over the roster's own entries, so a name still completes.
 *
 * 🚩 **The commit is on blur/Enter, not per keystroke.** A half-typed id is not a
 * filter; the toolbar's draft/query split already says a partial box must not fire
 * a query, and committing per keystroke would put `ServedByKind=COLLECTOR&ServedById=1`
 * into the draft on the way to `16138`.
 *
 * An empty box, or Escape, goes back to the dropdown with the selection untouched —
 * the estate is the dropdown's "Everyone", one pick away, so an abandoned box never
 * widens the grid behind the user's back.
 */
function ServedByIdInput({
  screen,
  entries,
  disabled,
  onCommit,
}: {
  screen: ServedByScreen
  entries: ServedByEntry[]
  disabled: boolean
  onCommit: (selection: ServedBySelection | null) => void
}) {
  const { t } = useTranslation('collection')
  const listId = `served-by-${screen}`

  const commit = (text: string) => {
    const parsed = parseServedByText(screen, text, entries)
    onCommit(parsed.kind === '' ? null : parsed)
  }

  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {t('servedBy.label')}
      <input
        type="text"
        role="combobox"
        list={listId}
        autoFocus
        disabled={disabled}
        inputMode="numeric"
        placeholder={t('servedBy.collected.idPlaceholder')}
        title={t('servedBy.collected.hint')}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit((e.target as HTMLInputElement).value)
          } else if (e.key === 'Escape') {
            e.preventDefault()
            onCommit(null)
          }
        }}
        className={FIELD_CLASS}
      />
      <datalist id={listId}>
        {entries.map((entry) => (
          <option key={`${entry.kind}:${entry.id}`} value={entry.label} />
        ))}
      </datalist>
    </label>
  )
}

/**
 * One suggestion's visible text — and, because a datalist option's value IS its
 * text, the thing `parseServedByText` matches on.
 *
 * ⚠️ The Kind has to be legible from the text alone, since there are no groups to
 * carry it: a supervisor reads as *"X's team"* and never as a bare name, or picking
 * a person who both collects and supervises would be two identical-looking lines.
 */
function labelFor(
  entry: Omit<ServedByEntry, 'label'>,
  t: (key: string, vars?: Record<string, unknown>) => string,
): string {
  if (entry.kind === SERVED_BY_KINDS.unassigned) return t('servedBy.collected.unassigned')
  if (entry.kind === SERVED_BY_KINDS.mine) {
    return entry.name === ''
      ? t('servedBy.collected.mineNoName')
      : t('servedBy.collected.mine', { name: entry.name })
  }
  if (entry.kind === SERVED_BY_KINDS.supervisor) {
    return t('servedBy.supervisorEntry', { name: entry.name || entry.id })
  }
  // Spec 2423: ACRs offer accountants too. Named as such, so a person who both
  // collects and accounts is two distinguishable lines, as a supervisor is. The
  // name is isolated whole (`fsi`): a datalist option is a string-only sink.
  if (entry.kind === SERVED_BY_KINDS.accountant) {
    return t('servedBy.accountantEntry', { name: fsi(entry.name || entry.id) })
  }
  return entry.name || entry.id
}
