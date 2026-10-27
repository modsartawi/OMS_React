import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { addCondition, canAddGroup, removeCondition, toggleNot, updateCondition, type ConditionPath } from '@/core/insurance-rules/guard-edit'
import type { GuardCondition } from '@/core/insurance-rules/model'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { fieldsQuery, keyedListsQuery } from '@/core/insurance-rules/registry-api'
import { factFields, factKind, factPath, fieldOfPath, unitKey } from '@/core/insurance-rules/registry-facts'
import { saysIn } from '@/core/rules/sentence'
import { fsi } from '@/core/util/bidi'
import { CodesInput } from './parts'
import { Field, NumberInput, Select } from '@/core/insurance-rules/controls'

// The conditions of a category or coverage rule (oms 617): the guard language's All of / Any of groups (three
// levels at most), NOT on any condition, and the facts a coverage decision reads — item fields, the request's
// payer / policy / class, the patient, the insurer's eligibility answer — all out of the Fields registry (610),
// plus patient and policy lists by id. The pure edits are the guard editor's (`@/core/insurance-rules/guard-edit`).

type Edit = (fn: (when: GuardCondition[]) => GuardCondition[], coalesce?: string) => void

const PALETTE = ['fact', 'policy', 'patient', 'group'] as const
const pathKey = (p: ConditionPath) => p.join('.')

/** A palette block with its defaults: a fact starts on the payer, the commonest test of a contract rule. */
function newBlock(kind: (typeof PALETTE)[number], fields: readonly RegistryField[]): GuardCondition {
  if (kind === 'group') return { check: 'group', mode: 'all', conditions: [] }
  if (kind === 'patient' || kind === 'policy') return { check: kind, inList: '' }
  const first = fieldOfPath(fields, '$request.payer') ?? factFields(fields)[0]
  if (!first) return { check: 'fact', path: '$request.payer', op: 'anyOf', value: [] }
  return factKind(first) === 'number' ? { check: 'fact', path: factPath(first), op: 'atLeast', value: 0 } : { check: 'fact', path: factPath(first), op: 'anyOf', value: [] }
}

export default function RuleConditions({ when, edit }: { when: GuardCondition[]; edit: Edit }) {
  const { t } = useTranslation('insurance-coverage')
  return (
    <div className="flex flex-col gap-2" data-conditions-editor="">
      <p className="text-xs text-muted-foreground">{t('conditions.top')}</p>
      {when.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground" data-conditions-empty="">
          {t('conditions.empty')}
        </p>
      )}
      <List when={when} list={when} parent={[]} edit={edit} />
    </div>
  )
}

function List({ when, list, parent, edit }: { when: GuardCondition[]; list: readonly GuardCondition[]; parent: ConditionPath; edit: Edit }) {
  return (
    <>
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((c, i) => (
            <li key={i}>
              <Node when={when} c={c} path={[...parent, i]} edit={edit} />
            </li>
          ))}
        </ul>
      )}
      <Add when={when} parent={parent} edit={edit} />
    </>
  )
}

function Add({ when, parent, edit }: { when: GuardCondition[]; parent: ConditionPath; edit: Edit }) {
  const { t } = useTranslation('insurance-coverage')
  const fields = useQuery(fieldsQuery()).data ?? []
  const groupOk = canAddGroup(when, parent)
  return (
    <Select
      value=""
      aria-label={t('conditions.add')}
      data-add-condition={pathKey(parent)}
      className="w-64"
      onChange={(e) => {
        const kind = e.target.value as (typeof PALETTE)[number]
        if (kind) edit((w) => addCondition(w, parent, newBlock(kind, fields)))
      }}
    >
      <option value="">{t('conditions.add')}</option>
      {PALETTE.map((k) => (
        <option key={k} value={k} disabled={k === 'group' && !groupOk}>
          {k === 'group' && !groupOk ? t('conditions.tooDeep') : t(`conditions.block.${k}`)}
        </option>
      ))}
    </Select>
  )
}

function Node({ when, c, path, edit }: { when: GuardCondition[]; c: GuardCondition; path: ConditionPath; edit: Edit }) {
  const { t } = useTranslation('insurance-coverage')
  const head = (
    <>
      <button
        type="button"
        aria-pressed={c.not === true}
        title={t('conditions.notHint')}
        data-not-toggle={pathKey(path)}
        onClick={() => edit((w) => toggleNot(w, path))}
        className={`h-6 rounded-md border px-2 font-mono text-[11px] font-semibold ${
          c.not ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 text-muted-foreground hover:bg-accent'
        }`}
      >
        {t('conditions.not')}
      </button>
    </>
  )
  const remove = (
    <button
      type="button"
      aria-label={t('conditions.remove')}
      title={t('conditions.remove')}
      data-remove={pathKey(path)}
      onClick={() => edit((w) => removeCondition(w, path))}
      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-accent"
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </button>
  )
  if (c.check === 'group')
    return (
      <div className="flex flex-col gap-2 rounded-e-md border-s-[3px] border-primary bg-muted/40 p-2" data-group={pathKey(path)} data-mode={c.mode} data-not={c.not ? 'true' : 'false'}>
        <div className="flex flex-wrap items-center gap-2">
          {head}
          <div className="inline-flex rounded-md border border-border/60" role="group" aria-label={t('conditions.mode')}>
            {(['all', 'any'] as const).map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={c.mode === m}
                data-mode-pick={m}
                onClick={() => edit((w) => updateCondition(w, path, (g) => (g.check === 'group' && g.mode !== m ? { ...g, mode: m } : g)))}
                className={`h-6 px-2 text-xs ${c.mode === m ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'}`}
              >
                {t(`conditions.${m}`)}
              </button>
            ))}
          </div>
          <span className="ms-auto">{remove}</span>
        </div>
        <div className="ps-2">
          <List when={when} list={c.conditions} parent={path} edit={edit} />
        </div>
      </div>
    )
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-border/60 bg-card p-2" data-block={pathKey(path)} data-check={c.check} data-not={c.not ? 'true' : 'false'}>
      {head}
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <Leaf c={c} path={path} edit={edit} />
      </div>
      {remove}
    </div>
  )
}

function Leaf({ c, path, edit }: { c: Exclude<GuardCondition, { check: 'group' }>; path: ConditionPath; edit: Edit }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const fields = useQuery(fieldsQuery()).data ?? []
  const set = (fn: (x: GuardCondition) => GuardCondition, coalesce?: string) =>
    edit((w) => updateCondition(w, path, fn), coalesce ? `${pathKey(path)}:${coalesce}` : undefined)

  if (c.check === 'patient' || c.check === 'policy')
    return (
      <Field label={t(`conditions.block.${c.check}`)}>
        <ListPick kind={c.check} value={c.inList} onPick={(id) => set((x) => ({ ...x, inList: id }) as GuardCondition)} />
      </Field>
    )
  if (c.check !== 'fact')
    // A block the guard palette has (history, line, …) but a coverage rule does not offer: shown, kept, not edited.
    return <code className="font-mono text-xs text-muted-foreground">{c.check}</code>

  const offered = factFields(fields)
  const def = fieldOfPath(fields, c.path)
  const isNumber = def ? factKind(def) === 'number' : typeof c.value === 'number'
  const uk = unitKey(def?.unit)
  return (
    <>
      <Field label={t('conditions.fact')}>
        <Select
          value={c.path}
          data-input="fact"
          onChange={(e) => {
            const next = fieldOfPath(fields, e.target.value)
            set((x) => ({ ...x, path: e.target.value, ...(next && factKind(next) === 'number' ? { op: 'atLeast', value: 0 } : { op: 'anyOf', value: [] }) }) as GuardCondition)
          }}
        >
          {!offered.some((f) => factPath(f) === c.path) && <option value={c.path}>{fsi(c.path)}</option>}
          {(['request', 'item', 'eligibility', 'patient'] as const).map((scope) => {
            const inScope = offered.filter((f) => f.scope === scope)
            return inScope.length ? (
              <optgroup key={scope} label={t(`conditions.scope.${scope}`)}>
                {inScope.map((f) => (
                  <option key={f.key} value={factPath(f)} data-scope={scope}>
                    {fsi(saysIn(f.label, i18n.language))}
                  </option>
                ))}
              </optgroup>
            ) : null
          })}
        </Select>
      </Field>
      <Select value={c.op} aria-label={t('conditions.op')} data-input="op" onChange={(e) => set((x) => ({ ...x, op: e.target.value }) as GuardCondition)}>
        {(isNumber ? (['atLeast', 'below'] as const) : (['anyOf', 'noneOf'] as const)).map((o) => (
          <option key={o} value={o}>
            {t(`conditions.opName.${o}`)}
          </option>
        ))}
      </Select>
      {isNumber ? (
        <Field label={t('conditions.value')} unit={uk ? t(`unit.${uk}`) : (def?.unit ?? undefined)}>
          <NumberInput value={Number(c.value)} data-input="value" onValue={(n) => set((x) => ({ ...x, value: n ?? 0 }) as GuardCondition, 'value')} />
        </Field>
      ) : (
        <Field label={t('conditions.codes')}>
          <CodesInput
            value={Array.isArray(c.value) ? c.value : [String(c.value)]}
            title={t('conditions.codesHint')}
            data-input="codes"
            onCodes={(codes) => set((x) => ({ ...x, value: codes }) as GuardCondition, 'value')}
          />
        </Field>
      )}
    </>
  )
}

function ListPick({ kind, value, onPick }: { kind: 'patient' | 'policy'; value: string; onPick: (id: string) => void }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const lists = useQuery(keyedListsQuery(kind)).data ?? []
  return (
    <Select value={value} invalid={!value} data-input="inList" onChange={(e) => onPick(e.target.value)}>
      {!lists.some((l) => l.id === value) && <option value={value}>{value ? fsi(value) : t('conditions.pickList')}</option>}
      {lists.map((l) => (
        <option key={l.id} value={l.id}>
          {fsi(saysIn(l.name, i18n.language))}
        </option>
      ))}
    </Select>
  )
}
