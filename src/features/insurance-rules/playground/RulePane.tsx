import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { useQuery } from '@tanstack/react-query'
import { ArrowDown, ArrowUp, Plus, X } from 'lucide-react'
import { RuleId } from '@/core/insurance-rules/badges'
import { indexChecks, type GuardIssue } from '@/core/insurance-rules/checks'
import { Issues } from '@/core/insurance-rules/controls'
import AudienceEditor from '@/core/insurance-rules/editors/AudienceEditor'
import ConditionEditor, { type RuleEdit } from '@/core/insurance-rules/editors/ConditionEditor'
import EffectEditor from '@/core/insurance-rules/editors/EffectEditor'
import { guardRulesetIn } from '@/core/insurance-rules/guard-wire'
import GuardSentenceView, { ConditionTree } from '@/core/insurance-rules/GuardSentenceView'
import type { GuardList, GuardRule } from '@/core/insurance-rules/model'
import type { PlaygroundKind, PlaygroundReaderError } from '@/core/insurance-rules/playground'
import { fieldsQuery } from '@/core/insurance-rules/registry-api'
import { guardSentence } from '@/core/insurance-rules/sentence'
import Button from '@/core/ui/Button'
import IconButton from '@/core/ui/IconButton'
import { fsi } from '@/core/util/bidi'
import { JsonPane } from './JsonPane'
import { addSlot, hasEditors, moveSlot, printRuleset, readRuleset, removeSlot, rulesetIssues, type RuleSlot, type RulesetRead } from './ruleset'

type Read = Extract<RulesetRead, { ok: true }>

/**
 * The Rule pane (oms 679): the scratch document's mini ruleset, built with core's real guard editors (676) — rules in
 * order, added, removed, moved — with the engine JSON live under them. The JSON box stays the source of truth: an
 * editor edit prints the document through `guard-wire` into the box, and a box edit that parses is read back into the
 * editors (`./ruleset`). While the box does not parse the editors show the last rules that did, disabled.
 * A rule the codec cannot read back stays JSON-only, with a note; it still runs. The reader's `errors[]` are placed on
 * their block with the guard editor's own marking (`indexChecks` / `fieldIssues`); the rest stay in the outcome.
 * A kind without editors (coverage, category until 680) shows the JSON box alone.
 */
export default function RulePane({
  kind,
  value,
  onChange,
  invalid,
  errors,
}: {
  kind: PlaygroundKind
  value: string
  onChange: (text: string) => void
  invalid: boolean
  /** The latest answer's reader errors, when it was asked for this kind; [] otherwise. */
  errors: readonly PlaygroundReaderError[]
}) {
  const { t } = useTranslation('insurance-playground')
  const editors = hasEditors(kind)
  // The text this pane last read or printed, and its reading. A box edit that parses re-reads; one that does not keeps
  // the last good reading (the editors follow "once it parses").
  const [model, setModel] = useState<{ text: string; kind: PlaygroundKind; read: Read | null; broken: boolean }>(() => {
    const r = readRuleset(kind, value)
    return { text: value, kind, read: r.ok ? r : null, broken: !r.ok }
  })
  if (model.text !== value || model.kind !== kind) {
    const r = readRuleset(kind, value)
    setModel({ text: value, kind, read: r.ok ? r : model.kind === kind ? model.read : null, broken: !r.ok })
  }
  const read = model.read

  const setSlots = (slots: RuleSlot[]) => {
    if (!read) return
    const next: Read = { ...read, slots }
    const text = printRuleset(next)
    setModel({ text, kind, read: next, broken: false })
    onChange(text)
  }

  const issues = useMemo(() => (read ? rulesetIssues(errors, read.slots).perRule : []), [errors, read])
  const lists = useMemo(() => (read ? guardRulesetIn(read.doc).lists : []), [read])

  return (
    <JsonPane
      box="document"
      title={t('rule.title')}
      hint={t(editors ? 'rule.hintEditors' : 'rule.hint')}
      value={value}
      onChange={onChange}
      invalid={invalid}
      before={
        editors && read ? (
          <fieldset disabled={model.broken} className="flex min-w-0 flex-col gap-3 disabled:opacity-60" data-ruleset="" data-broken={model.broken || undefined}>
            <legend className="sr-only">{t('ruleset.label')}</legend>
            {model.broken && (
              <p className="text-xs text-attention-800" role="status" data-ruleset-stale="">
                {t('ruleset.broken')}
              </p>
            )}
            {read.slots.length === 0 && (
              <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground" data-ruleset-empty="">
                {t('ruleset.empty')}
              </p>
            )}
            <ol className="flex flex-col gap-3">
              {read.slots.map((slot, i) => (
                <RuleCard
                  key={slot.key}
                  slot={slot}
                  index={i}
                  count={read.slots.length}
                  lists={lists}
                  issues={issues[i] ?? []}
                  onSlot={(s) => setSlots(read.slots.map((x, j) => (j === i ? s : x)))}
                  onMove={(to) => setSlots(moveSlot(read.slots, i, to))}
                  onRemove={() => setSlots(removeSlot(read.slots, i))}
                />
              ))}
            </ol>
            <Button variant="secondary" className="w-fit" onClick={() => setSlots(addSlot(kind, read.slots))} data-add-rule="">
              <Plus className="h-3.5 w-3.5" aria-hidden />
              {t('ruleset.add')}
            </Button>
          </fieldset>
        ) : null
      }
    />
  )
}

function RuleCard({
  slot,
  index,
  count,
  lists,
  issues,
  onSlot,
  onMove,
  onRemove,
}: {
  slot: RuleSlot
  index: number
  count: number
  lists: GuardList[]
  issues: GuardIssue[]
  onSlot: (s: RuleSlot) => void
  onMove: (to: number) => void
  onRemove: () => void
}) {
  const { t } = useTranslation('insurance-playground')
  const id = slot.editable ? slot.rule.id : typeof (slot.raw as { id?: unknown } | null)?.id === 'string' ? (slot.raw as { id: string }).id : ''
  const n = fsi(String(index + 1))
  return (
    <li
      className={`flex min-w-0 flex-col gap-3 rounded-md border bg-card p-3 ${issues.length ? 'border-danger-border' : 'border-border/60'}`}
      data-rule-slot={index}
      data-slot-rule-id={id}
      data-editable={String(slot.editable)}
    >
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('ruleset.rule', { n })}</span>
        {id && <RuleId id={id} />}
        <span className="ms-auto flex items-center gap-1">
          <IconButton size="compact" label={t('ruleset.up', { n })} disabled={index === 0} onClick={() => onMove(index - 1)} data-move-up={index}>
            <ArrowUp className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton size="compact" label={t('ruleset.down', { n })} disabled={index === count - 1} onClick={() => onMove(index + 1)} data-move-down={index}>
            <ArrowDown className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
          <IconButton variant="danger" size="compact" label={t('ruleset.remove', { n })} onClick={onRemove} data-remove-rule={index}>
            <X className="h-3.5 w-3.5" aria-hidden />
          </IconButton>
        </span>
      </header>
      {slot.editable ? (
        <GuardRuleEditors
          rule={slot.rule}
          lists={lists}
          issues={issues}
          edit={(fn) => onSlot({ ...slot, rule: fn(slot.rule) })}
        />
      ) : (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground" data-json-only="">
          {t('ruleset.jsonOnly')}
        </p>
      )}
    </li>
  )
}

/** One rule: the guard screen's WHEN / IF / THEN editors, the reader's errors on their blocks, and the rule in words. */
function GuardRuleEditors({ rule, lists, issues, edit }: { rule: GuardRule; lists: GuardList[]; issues: GuardIssue[]; edit: RuleEdit }) {
  const { t } = useTranslation('insurance-guards')
  const index = useMemo(() => indexChecks(issues, rule), [issues, rule])
  return (
    <div className="flex min-w-0 flex-col gap-3">
      <Issues issues={index.rule} hook="rule" />
      <Part kw={t('rule.when')} hook="when">
        <AudienceEditor rule={rule} edit={edit} />
      </Part>
      <Part kw={t('rule.if')} hook="if">
        <ConditionEditor rule={rule} lists={lists} edit={edit} checks={index} />
      </Part>
      <Part kw={t('rule.then')} hook="then">
        <EffectEditor rule={rule} edit={edit} checks={index} />
      </Part>
      <RuleWords rule={rule} lists={lists} />
    </div>
  )
}

function Part({ kw, hook, children }: { kw: string; hook: string; children: ReactNode }) {
  return (
    <section className="flex min-w-0 flex-col gap-2" data-part={hook}>
      <h3 className="text-xs font-semibold text-muted-foreground">{kw}</h3>
      {children}
    </section>
  )
}

/** The rule read as sentences (`GuardSentenceView`), the guard rule page's words. */
function RuleWords({ rule, lists }: { rule: GuardRule; lists: GuardList[] }) {
  const { t } = useTranslation('insurance-playground')
  const fields = useQuery(fieldsQuery()).data
  const s = guardSentence(rule, lists, fields)
  return (
    <section className="rounded-md border border-border/60 bg-muted/40 p-2 text-sm" data-rule-words="">
      <h3 className="mb-1 text-xs font-semibold text-muted-foreground">{t('ruleset.readsAs')}</h3>
      <ul className="flex flex-col gap-1">
        {s.when.map((w, i) => (
          <li key={i} data-sentence="">
            <GuardSentenceView s={w} />
          </li>
        ))}
      </ul>
      {s.conditions.length > 0 && <ConditionTree nodes={s.conditions} />}
      <ul className="mt-1 flex flex-col gap-1">
        {s.then.map((e, i) => (
          <li key={i} data-sentence="" data-effect={e.severity}>
            <GuardSentenceView s={e.does} />
          </li>
        ))}
      </ul>
    </section>
  )
}
