import { useRef } from 'react'
import { useTranslation } from 'react-i18next'
import { blockKey, fieldIssues, type ChecksIndex } from '@/core/insurance-rules/checks'
import { GUARD_PLACEHOLDERS, SUGGESTIONS, codesAreDefault, defaultCodes, insertPlaceholder, refusedPlaceholders } from '@/core/insurance-rules/guard-edit'
import { GUARD_SEVERITIES, type GuardEffect, type GuardRule } from '@/core/insurance-rules/model'
import { fsi } from '@/core/util/bidi'
import type { RuleEdit } from './ConditionEditor'
import { CodeInput, Field, Issues, Select } from '@/core/insurance-rules/controls'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import UiField from '@/core/ui/Field'
import Textarea from '@/core/ui/Textarea'

// The THEN of the guard editor (ticket 608): per effect, the severity (REFUSE > OVERRIDE > WARN), the EN and
// AR message with placeholder chips (never `{lastStore}`), the codes (defaulted from the first block until
// the author edits them) and an optional suggestion.

export default function EffectEditor({ rule, edit, checks }: { rule: GuardRule; edit: RuleEdit; checks: ChecksIndex }) {
  return (
    <div className="flex flex-col gap-4">
      {rule.then.map((e, i) => (
        <OneEffect key={i} rule={rule} e={e} index={i} edit={edit} checks={checks} />
      ))}
    </div>
  )
}

function OneEffect({ rule, e, index, edit, checks }: { rule: GuardRule; e: GuardEffect; index: number; edit: RuleEdit; checks: ChecksIndex }) {
  const { t } = useTranslation('insurance-guards')
  const issues = checks.blocks.get(blockKey('then', [index])) ?? []
  const setEffect = (fn: (x: GuardEffect) => GuardEffect, field?: string) =>
    edit((r) => ({ ...r, then: r.then.map((x, j) => (j === index ? fn(x) : x)) }), field ? `then:${index}:${field}` : undefined)
  const refused = refusedPlaceholders(e.says)
  const isDefault = codesAreDefault(rule, e)
  const suggestKey = Object.keys(e.suggest ?? {})[0] ?? ''

  return (
    <div className="flex flex-col gap-3" data-effect-editor={index}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('editor.severity')}</span>
        <div className="inline-flex gap-1" role="group" aria-label={t('editor.severity')}>
          {GUARD_SEVERITIES.map((s) => (
            <Chip
              key={s}
              on={e.severity === s}
              data-severity-pick={s}
              onClick={() => setEffect((x) => (x.severity === s ? x : { ...x, severity: s }))}
            >
              {t(`insurance-rules:severity.${s}`)}
            </Chip>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{t(`insurance-rules:sentence.then.${e.severity}`)}</span>
      </div>

      <MessageBox
        lang="en"
        value={e.says.en}
        invalid={fieldIssues(issues, 'says.en').length > 0}
        onValue={(v) => setEffect((x) => ({ ...x, says: { ...x.says, en: v } }), 'says.en')}
      />
      <MessageBox
        lang="ar"
        value={e.says.ar}
        invalid={fieldIssues(issues, 'says.ar').length > 0}
        onValue={(v) => setEffect((x) => ({ ...x, says: { ...x.says, ar: v } }), 'says.ar')}
      />
      {refused.map((p) => (
        <p key={p} className="text-xs text-danger-800" data-refused-placeholder={p}>
          {t('editor.message.refused', { name: fsi(`{${p}}`) })}
        </p>
      ))}

      <div className="flex flex-wrap items-center gap-3" data-codes-editor="">
        <span className="text-xs text-muted-foreground">{t('editor.codes.label')}</span>
        <Field label={t('editor.codes.conflict')}>
          <CodeInput
            value={e.codes?.conflict ?? ''}
            className="w-20"
            invalid={fieldIssues(issues, 'codes.conflict').length > 0}
            data-input="conflict"
            onValue={(s) => setEffect((x) => ({ ...x, codes: { conflict: s.trim() || null, nphies: x.codes?.nphies ?? null } }), 'codes.conflict')}
          />
        </Field>
        <Field label={t('editor.codes.nphies')}>
          <CodeInput
            value={e.codes?.nphies ?? ''}
            className="w-24"
            invalid={fieldIssues(issues, 'codes.nphies').length > 0}
            data-input="nphies"
            onValue={(s) => setEffect((x) => ({ ...x, codes: { conflict: x.codes?.conflict ?? null, nphies: s.trim() || null } }), 'codes.nphies')}
          />
        </Field>
        <span className="text-xs text-muted-foreground" data-codes-source={isDefault ? 'default' : 'author'}>
          {t(isDefault ? 'editor.codes.default' : 'editor.codes.edited')}
        </span>
        {!isDefault && (
          <button
            type="button"
            className="text-xs text-primary hover:underline"
            data-codes-reset=""
            onClick={() => setEffect((x) => ({ ...x, codes: { ...defaultCodes(rule.when) } }))}
          >
            {t('editor.codes.reset')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3" data-suggest-editor="">
        <Field label={t('editor.suggest.label')}>
          <Select
            value={suggestKey}
            data-input="suggest"
            onChange={(ev) => {
              const k = ev.target.value
              const def = SUGGESTIONS.find((s) => s.key === k)
              setEffect((x) => ({ ...x, suggest: def ? { [def.key]: def.value } : null }))
            }}
          >
            <option value="">{t('editor.suggest.none')}</option>
            {SUGGESTIONS.map((s) => (
              <option key={s.key} value={s.key}>
                {t(`editor.suggest.${s.key}`)}
              </option>
            ))}
          </Select>
        </Field>
        {suggestKey && (
          <Field label={t('editor.suggest.value')}>
            <CodeInput
              value={String(e.suggest?.[suggestKey] ?? '')}
              className="w-44"
              data-input="suggestValue"
              onValue={(s) => setEffect((x) => ({ ...x, suggest: { [suggestKey]: s } }), 'suggest')}
            />
          </Field>
        )}
      </div>
      <Issues issues={issues} hook={`then.${index}`} />
    </div>
  )
}

/** One language of the message, with the placeholder chips that type `{name}` at the caret. */
function MessageBox({ lang, value, invalid, onValue }: { lang: 'en' | 'ar'; value: string; invalid: boolean; onValue: (v: string) => void }) {
  const { t } = useTranslation('insurance-guards')
  const ref = useRef<HTMLTextAreaElement>(null)
  const insert = (name: string) => {
    const box = ref.current
    const { text, caret } = insertPlaceholder(value, box ? box.selectionStart : null, name)
    onValue(text)
    requestAnimationFrame(() => {
      box?.focus()
      box?.setSelectionRange(caret, caret)
    })
  }
  return (
    <div className="flex flex-col gap-1" data-message-editor={lang}>
      <UiField label={t(`editor.message.${lang}`)} invalid={invalid}>
        <Textarea
          id={`guard-message-${lang}`}
          ref={ref}
          rows={2}
          dir={lang === 'ar' ? 'rtl' : 'ltr'}
          lang={lang}
          value={value}
          onChange={(e) => onValue(e.target.value)}
          data-input={`says.${lang}`}
        />
      </UiField>
      <div className="flex flex-wrap items-center gap-1" data-placeholders={lang} title={t('editor.message.placeholdersHint')}>
        <span className="text-xs text-muted-foreground">{t('editor.message.placeholders')}</span>
        {GUARD_PLACEHOLDERS.map((p) => (
          <Button key={p} variant="outlined" data-placeholder={p} onClick={() => insert(p)} className="font-mono">
            <bdi dir="ltr">{`{${p}}`}</bdi>
          </Button>
        ))}
      </div>
    </div>
  )
}
