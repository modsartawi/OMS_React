import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { CodesInput, Field } from '@/core/insurance-rules/controls'
import { effectiveChannels, setAudienceStores, setWindow, toggleAudienceExclude, toggleChannel } from '@/core/insurance-rules/guard-edit'
import { GUARD_CHANNELS, type GuardRule } from '@/core/insurance-rules/model'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import type { RuleEdit } from './ConditionEditor'
import { KeyedListSelect } from './ConditionEditor'
import { KEYED_LIST_KINDS } from '@/core/insurance-rules/registry'

const EXCLUDE_LABEL = { patient: 'editor.audience.excludePatients', policy: 'editor.audience.excludePolicies', class: 'editor.audience.excludeClasses' } as const

// The WHEN of the guard editor (review 3126 P4, story 16): the channels a rule is checked on, its stores (none =
// every store), the patient / policy / class lists left out of its audience (a VIP list), and its window. A new rule
// starts on every channel at every store with no window (`newGuardRule`); everything here changes it.

export default function AudienceEditor({ rule, edit }: { rule: GuardRule; edit: RuleEdit }) {
  const { t } = useTranslation('insurance-guards')
  // As built an audience holds only the keys it sets: no channels / stores named = every one.
  const a = { ...rule.audience, channels: rule.audience?.channels ?? [], stores: rule.audience?.stores ?? [] }
  const on = effectiveChannels(rule)
  return (
    <div className="flex flex-col gap-3 text-xs" data-audience-editor="">
      <fieldset className="flex flex-wrap items-center gap-3">
        <legend className="sr-only">{t('editor.audience.channels')}</legend>
        <span className="text-muted-foreground">{t('editor.audience.channels')}</span>
        {GUARD_CHANNELS.map((ch) => (
          <label key={ch} className="inline-flex items-center gap-1">
            <input type="checkbox" checked={on.includes(ch)} data-channel={ch} onChange={() => edit((r) => toggleChannel(r, ch))} />
            {t(`insurance-rules:sentence.channel.${ch}`)}
          </label>
        ))}
      </fieldset>
      <Field label={t('editor.audience.stores')}>
        <CodesInput
          value={a.stores}
          title={t('editor.audience.storesHint')}
          placeholder={t('editor.audience.allStores')}
          data-input="stores"
          onCodes={(stores) => edit((r) => setAudienceStores(r, stores), 'audience.stores')}
        />
      </Field>
      {KEYED_LIST_KINDS.map((kind) => {
        const ids = { patient: a.excludePatientLists, policy: a.excludePolicyLists, class: a.excludeClassLists }[kind] ?? []
        return (
          <div key={kind} className="flex flex-wrap items-center gap-2" data-exclude={kind}>
            <span className="text-muted-foreground">{t(EXCLUDE_LABEL[kind])}</span>
            {ids.map((id) => (
              <span key={id} className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5" data-excluded={id}>
                <Ltr>{id}</Ltr>
                <IconButton
                  variant="danger"
                  size="compact"
                  label={t('editor.audience.removeExclude', { list: fsi(id) })}
                  onClick={() => edit((r) => toggleAudienceExclude(r, kind, id))}
                >
                  <X className="h-3 w-3" aria-hidden />
                </IconButton>
              </span>
            ))}
            <KeyedListSelect kind={kind} value="" invalid={false} onPick={(id) => id && !ids.includes(id) && edit((r) => toggleAudienceExclude(r, kind, id))} />
          </div>
        )
      })}
      <div className="flex flex-wrap items-center gap-3">
        <Field label={t('editor.audience.from')}>
          <Input
            type="date"
            dir="ltr"
            value={rule.window?.from ?? ''}
            onChange={(e) => edit((r) => setWindow(r, { from: e.target.value }))}
            data-input="window.from"
          />
        </Field>
        <Field label={t('editor.audience.until')}>
          <Input
            type="date"
            dir="ltr"
            value={rule.window?.until ?? ''}
            title={t('editor.audience.untilOpen')}
            onChange={(e) => edit((r) => setWindow(r, { until: e.target.value }))}
            data-input="window.until"
          />
        </Field>
      </div>
    </div>
  )
}
