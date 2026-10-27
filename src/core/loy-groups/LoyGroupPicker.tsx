import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import MultiSelect, { type MultiSelectOption } from '@/core/ui/MultiSelect'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { formatPair } from '@/core/util/bidi'
import { canViewLoyGroups, loyGroupName, loyGroupsAccessQuery, loyGroupsQuery } from './api'
import { readLoyGroupSelection, writeLoyGroupSelection } from './selection'

export interface LoyGroupPickerProps {
  /** The wire's comma-separated upper-case code string (`loyGroups`), as the form holds it. */
  value: string
  /** The next code string, in the same shape — drop it straight back into the form. */
  onChange: (next: string) => void
  /** The trigger's id; inside a `Field` it is wired like `Input` without one. */
  id?: string
  disabled?: boolean
  /** The accessible name of the picker's panel (the Field's label, already translated). */
  label: string
  'data-testid'?: string
}

/**
 * The loyalty groups a bonus-buy is offered to, picked from the defined groups (oms ticket 636;
 * BackOffice 3179). Shared by bonus-buy maintenance (636) and simulation (637), so it is in core.
 *
 * - Options are `LoyGroupWeb/Groups?includeInactive=true`: `code · name` in the UI language, an
 *   inactive group greyed and marked (the server warns, and still saves).
 * - A chosen code that is not a defined group is KEPT as a flagged chip (D2), never dropped.
 * - The probe answered without the view grant: read-only text of the codes.
 * - The probe pending, failed or 404 (the door is deployed nowhere yet): the pre-636 editable free-text
 *   box, so a maintainer never loses the field to a missing door.
 */
export default function LoyGroupPicker({ value, onChange, id, disabled, label, 'data-testid': testId }: LoyGroupPickerProps) {
  const { t, i18n } = useTranslation('loy-groups')
  const access = useQuery(loyGroupsAccessQuery())
  const canView = canViewLoyGroups(access.data)
  const groups = useQuery({ ...loyGroupsQuery(true), enabled: canView })
  const selection = readLoyGroupSelection(value, groups.data)

  if (!canView && !access.isSuccess) {
    // OWNER DECISION (review of 636): while the probe is pending, errored or 404, keep today's
    // editable free-text box — the pre-636 behaviour. Read-only text is ONLY for a probe that
    // answered and said `canView: false`. (Simulation, D3, never mounts the picker without the grant.)
    return (
      <Textarea
        id={id}
        dir="ltr"
        rows={3}
        className="w-full resize-y font-mono"
        value={value}
        disabled={disabled}
        data-testid={testId}
        data-loy-groups-freetext=""
        onChange={(e) => onChange(e.target.value)}
      />
    )
  }

  if (!canView) {
    return (
      <p className="flex min-h-7 items-center text-xs" id={id} data-testid={testId} data-loy-groups-readonly="">
        {selection.codes.length ? (
          <span className="font-mono">
            <Ltr>{writeLoyGroupSelection(selection.codes)}</Ltr>
          </span>
        ) : (
          <span className="text-muted-foreground">{t('picker.noneChosen')}</span>
        )}
      </p>
    )
  }

  const options: MultiSelectOption[] = (groups.data ?? []).map((g) => ({
    value: g.code.toUpperCase(),
    text: formatPair(g.code, loyGroupName(g, i18n.language)),
    machine: true,
    tone: g.isActive ? 'default' : 'muted',
    note: g.isActive ? undefined : t('picker.inactive'),
  }))

  return (
    <MultiSelect
      id={id}
      label={label}
      value={selection.codes}
      onChange={(codes) => onChange(writeLoyGroupSelection(codes))}
      options={options}
      optionOf={(code) => ({
        value: code,
        text: code,
        machine: true,
        // Unknown only once the list says so: while it loads, a code is just a code.
        tone: groups.data ? 'danger' : 'default',
        note: groups.data ? t('picker.unknown') : undefined,
      })}
      disabled={disabled}
      loading={groups.isPending}
      failed={groups.isError}
      data-testid={testId}
    />
  )
}
