// core/insurance-rules/editors (oms 676): the guard, coverage and category block editors, shared by the guards and
// coverage features and the rule playground. They still read the `insurance-guards` / `insurance-coverage` namespaces —
// a namespace is a string, not an import, so the boundary holds; the coverage feature's and core/insurance-rules' i18n-keys tests cover them.
import { createContext, useContext } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { blockKey, type ChecksIndex } from '@/core/insurance-rules/checks'
import { Issues } from '@/core/insurance-rules/controls'
import { addCondition, canAddGroup, removeCondition, toggleNot, updateCondition, type ConditionPath } from '@/core/insurance-rules/guard-edit'
import {
  ELIGIBILITY_BOUNDS,
  eligibilityTests,
  REQUEST_FIELDS,
  requestListField,
  type EligibilityCondition,
  type EligibilityTest,
  type GuardCondition,
  type GuardList,
  type LineCondition,
  type RequestCondition,
} from '@/core/insurance-rules/model'
import type { KeyedListKind, RegistryField } from '@/core/insurance-rules/registry'
import { usesFhirFacts } from '@/core/insurance-rules/fact-tests'
import { fhirCatalogQuery, fieldsQuery, keyedListsQuery } from '@/core/insurance-rules/registry-api'
import { factFields, factKind, factPath, fieldOfPath, unitKey } from '@/core/insurance-rules/registry-facts'
import { conditionSentence } from '@/core/insurance-rules/sentence'
import GuardSentenceView from '@/core/insurance-rules/GuardSentenceView'
import { saysIn } from '@/core/rules/sentence'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { CodeInput, CodesInput, Field, NumberInput, Select } from '@/core/insurance-rules/controls'
import { drawsAsEligibilityRow, drawsAsFactRow, listSummary, renameTest, testChoices } from './conditions'
import { ConditionTools, DragHandle, DropZone, SelectTick, TreeToolbar, TreeToolsProvider } from '@/core/insurance-rules/ConditionTreeTools'

// The conditions of a category or coverage rule (oms 617): the guard language's All of / Any of groups (three
// levels at most), NOT on any condition, and the facts a coverage decision reads — item fields, the request's
// payer / policy / class, the patient, the insurer's eligibility answer — all out of the Fields registry (610),
// plus patient, policy and class lists by id. The pure edits are the guard editor's (`@/core/insurance-rules/guard-edit`).
// oms 674: the item lists of the document itself (`{ check: "line", inList }`), the eligibility blocks the codec keeps as
// written, and the request's codes are edited too; any other block reads as its sentence, kept as written.

type Edit = (fn: (when: GuardCondition[]) => GuardCondition[], coalesce?: string) => void

/** The document's own item lists, for the item-list rows and the palette. */
const DocLists = createContext<readonly GuardList[]>([])
/** Issues placed on the blocks (oms 680: the rule playground's reader errors); none on the rule screens. */
const BlockChecks = createContext<ChecksIndex | null>(null)

const PALETTE = ['fact', 'item', 'policy', 'class', 'patient', 'group'] as const
const pathKey = (p: ConditionPath) => p.join('.')

/** A palette block with its defaults: a fact starts on the payer, the commonest test of a contract rule. */
function newBlock(kind: (typeof PALETTE)[number], fields: readonly RegistryField[]): GuardCondition {
  if (kind === 'group') return { check: 'group', mode: 'all', conditions: [] }
  if (kind === 'patient') return { check: 'patient', inList: '' }
  if (kind === 'item') return { check: 'line', inList: '' }
  if (kind === 'policy' || kind === 'class') return { check: 'request', field: kind, inList: '' }
  const first = fieldOfPath(fields, '$request.payer') ?? factFields(fields)[0]
  if (!first) return { check: 'fact', path: '$request.payer', op: 'anyOf', value: [] }
  return factKind(first) === 'number' ? { check: 'fact', path: factPath(first), op: 'atLeast', value: 0 } : { check: 'fact', path: factPath(first), op: 'anyOf', value: [] }
}

const NO_LISTS: readonly GuardList[] = []

export default function RuleConditions({
  when,
  edit,
  lists = NO_LISTS,
  checks = null,
}: {
  when: GuardCondition[]
  edit: Edit
  lists?: readonly GuardList[]
  /** oms 680: issues to show on their block (`blockKey('when', path)`), as the guard condition editor marks them. */
  checks?: ChecksIndex | null
}) {
  const { t } = useTranslation('insurance-coverage')
  return (
    // oms 658: drag and drop and the condition tools, each move one edit of the rule.
    <DocLists.Provider value={lists}>
    <BlockChecks.Provider value={checks}>
    <TreeToolsProvider when={when} apply={(fn) => edit(fn)}>
    <div className="flex flex-col gap-2" data-conditions-editor="">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">{t('conditions.top')}</p>
        {when.length > 0 && <TreeToolbar />}
      </div>
      {when.length === 0 && (
        <p className="rounded-md border border-dashed border-border px-3 py-2 text-xs text-muted-foreground" data-conditions-empty="">
          {t('conditions.empty')}
        </p>
      )}
      <List when={when} list={when} parent={[]} edit={edit} />
    </div>
    </TreeToolsProvider>
    </BlockChecks.Provider>
    </DocLists.Provider>
  )
}

function List({ when, list, parent, edit }: { when: GuardCondition[]; list: readonly GuardCondition[]; parent: ConditionPath; edit: Edit }) {
  return (
    <>
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((c, i) => (
            <li key={i} className="flex flex-col gap-2">
              <DropZone parent={parent} index={i} />
              <Node when={when} c={c} path={[...parent, i]} edit={edit} />
            </li>
          ))}
        </ul>
      )}
      <DropZone parent={parent} index={list.length} empty={list.length === 0} />
      <Add when={when} parent={parent} edit={edit} />
    </>
  )
}

function Add({ when, parent, edit }: { when: GuardCondition[]; parent: ConditionPath; edit: Edit }) {
  const { t } = useTranslation('insurance-coverage')
  const fields = useQuery(fieldsQuery()).data ?? []
  const lists = useContext(DocLists)
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
      {PALETTE.filter((k) => k !== 'item' || lists.length > 0).map((k) => (
        <option key={k} value={k} disabled={k === 'group' && !groupOk}>
          {k === 'group' && !groupOk ? t('conditions.tooDeep') : t(`conditions.block.${k}`)}
        </option>
      ))}
    </Select>
  )
}

function Node({ when, c, path, edit }: { when: GuardCondition[]; c: GuardCondition; path: ConditionPath; edit: Edit }) {
  const { t } = useTranslation('insurance-coverage')
  const issues = useContext(BlockChecks)?.blocks.get(blockKey('when', path)) ?? []
  const marked = issues.length > 0
  const head = (
    <>
      <SelectTick path={path} />
      <DragHandle path={path} />
      <button
        type="button"
        aria-pressed={c.not === true}
        title={t('conditions.notHint')}
        data-not-toggle={pathKey(path)}
        onClick={() => edit((w) => toggleNot(w, path))}
        className={`h-7 rounded-full border px-3 font-mono text-[11px] font-semibold ${
          c.not ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border bg-card text-muted-foreground hover:bg-accent'
        }`}
      >
        {t('conditions.not')}
      </button>
    </>
  )
  const remove = (
    <IconButton label={t('conditions.remove')} variant="danger" size="compact" data-remove={pathKey(path)} onClick={() => edit((w) => removeCondition(w, path))}>
      <X className="h-3.5 w-3.5" aria-hidden />
    </IconButton>
  )
  if (c.check === 'group')
    return (
      <div className={`flex flex-col gap-2 rounded-e-md border-s-[3px] bg-muted/40 p-2 ${marked ? 'border-danger-border' : 'border-primary'}`} data-group={pathKey(path)} data-mode={c.mode} data-not={c.not ? 'true' : 'false'}>
        <div className="flex flex-wrap items-center gap-2">
          {head}
          <div className="inline-flex gap-1" role="group" aria-label={t('conditions.mode')}>
            {(['all', 'any'] as const).map((m) => (
              <Chip
                key={m}
                on={c.mode === m}
                data-mode-pick={m}
                onClick={() => edit((w) => updateCondition(w, path, (g) => (g.check === 'group' && g.mode !== m ? { ...g, mode: m } : g)))}
              >
                {t(`conditions.${m}`)}
              </Chip>
            ))}
          </div>
          <span className="ms-auto flex items-center gap-1">
            <ConditionTools path={path} />
            {remove}
          </span>
        </div>
        <Issues issues={issues} hook={pathKey(path)} />
        <div className="ps-2">
          <List when={when} list={c.conditions} parent={path} edit={edit} />
        </div>
      </div>
    )
  return (
    <div className={`flex flex-wrap items-center gap-2 rounded-md border bg-card p-2 ${marked ? 'border-danger-border' : 'border-border'}`} data-block={pathKey(path)} data-check={requestListField(c) ?? c.check} data-not={c.not ? 'true' : 'false'}>
      {head}
      <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
        <Leaf c={c} path={path} edit={edit} />
      </div>
      <ConditionTools path={path} />
      {remove}
      {marked && (
        <div className="basis-full">
          <Issues issues={issues} hook={pathKey(path)} />
        </div>
      )}
    </div>
  )
}

function Leaf({ c, path, edit }: { c: Exclude<GuardCondition, { check: 'group' }>; path: ConditionPath; edit: Edit }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const fields = useQuery(fieldsQuery()).data ?? []
  const set = (fn: (x: GuardCondition) => GuardCondition, coalesce?: string) =>
    edit((w) => updateCondition(w, path, fn), coalesce ? `${pathKey(path)}:${coalesce}` : undefined)

  if (c.check === 'patient')
    return (
      <Field label={t('conditions.block.patient')}>
        <ListPick kind="patient" value={c.inList} onPick={(id) => set((x) => ({ ...x, inList: id }) as GuardCondition)} />
      </Field>
    )
  if (c.check === 'request') {
    // Switch on the field: `policy` / `class` with `inList` is a team list; any other request block (a payer or a
    // class read by codes, a field this build does not know) shows its field and its codes, kept as written.
    const listField = requestListField(c)
    if (listField)
      return (
        <Field label={t(`conditions.block.${listField}`)}>
          <ListPick kind={listField} value={c.inList ?? ''} onPick={(id) => set((x) => ({ ...x, inList: id }) as GuardCondition)} />
        </Field>
      )
    // oms 674: a request field read by codes (the payer, …) edits its codes; `inList` on another field reads as written.
    if (isCodesOnly(c)) return <RequestCodes c={c} fields={fields} set={set} />
    return <KeptAsWritten c={c} fields={fields} />
  }
  if (c.check === 'line' && typeof c.inList === 'string' && c.field === undefined) return <ItemList c={c as LineCondition & { inList: string }} fields={fields} set={set} />
  if (c.check === 'eligibility') return drawsAsEligibilityRow(c) ? <Eligibility c={c} fields={fields} set={set} /> : <KeptAsWritten c={c} fields={fields} />
  if (c.check !== 'fact')
    // A block the guard palette has (history, a line field, …) but a coverage rule does not offer: its sentence, kept.
    return <KeptAsWritten c={c} fields={fields} />
  // Oms 693: a fact of a new type, which this row cannot draw. It keeps its value, and NOT and Remove still work.
  if (!drawsAsFactRow(c)) return <KeptAsWritten c={c} fields={fields} />

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
          {(['request', 'line', 'eligibility', 'patient'] as const).map((scope) => {
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

function ListPick({ kind, value, onPick }: { kind: KeyedListKind; value: string; onPick: (id: string) => void }) {
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

type Set = (fn: (x: GuardCondition) => GuardCondition, coalesce?: string) => void

/** A request block that tests only codes (`{ field, anyOf }`, NOT aside): any other test (a number bound, …) is kept as written. */
const isCodesOnly = (c: RequestCondition): boolean => Object.keys(c).every((k) => k === 'check' || k === 'field' || k === 'anyOf' || k === 'not') && Array.isArray(c.anyOf)

/** A block this editor does not draw: the sentence the "Reads as" pane gives it (NOT is the toggle beside it), kept as written. */
function KeptAsWritten({ c, fields }: { c: Exclude<GuardCondition, { check: 'group' }>; fields: readonly RegistryField[] }) {
  const { t } = useTranslation('insurance-coverage')
  const lists = useContext(DocLists)
  const catalog = useQuery({ ...fhirCatalogQuery(), enabled: usesFhirFacts([c]) }).data
  const read = conditionSentence({ ...c, not: false }, { rule: { filters: [] }, lists, fields, catalog })
  return (
    <span className="flex flex-wrap items-baseline gap-x-2 text-xs" data-kept-as-written={c.check}>
      <span data-sentence="">
        <GuardSentenceView s={read.sentence} />
        {read.clauses.map((x, i) => (
          <span key={i} data-clause="">
            {t('conditions.clauseJoin')}
            <GuardSentenceView s={x} />
          </span>
        ))}
      </span>
      <span className="text-muted-foreground">{t('conditions.notEditable')}</span>
    </span>
  )
}

/** The request's field (payer, …) by its registry name, and its codes. */
function RequestCodes({ c, fields, set }: { c: RequestCondition; fields: readonly RegistryField[]; set: Set }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const def = fieldOfPath(fields, `$request.${c.field}`)
  const label = def
    ? saysIn(def.label, i18n.language)
    : (REQUEST_FIELDS as readonly string[]).includes(c.field)
      ? t(`insurance-rules:sentence.request.field.${c.field}`)
      : fsi(c.field)
  return (
    <Field label={label}>
      <CodesInput
        value={c.anyOf ?? []}
        invalid={(c.anyOf ?? []).length === 0}
        title={t('conditions.codesHint')}
        data-input="codes"
        data-request-field={c.field}
        onCodes={(codes) => set((x) => ({ ...x, anyOf: codes }) as GuardCondition, 'anyOf')}
      />
    </Field>
  )
}

/** The item is in one of the document's own lists: picked by name, with what the list filters on beside it. */
function ItemList({ c, fields, set }: { c: LineCondition & { inList: string }; fields: readonly RegistryField[]; set: Set }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const lists = useContext(DocLists)
  const list = lists.find((l) => l.id === c.inList)
  return (
    <>
      <Field label={t('conditions.block.item')}>
        <Select value={c.inList} invalid={!list} data-input="itemList" onChange={(e) => set((x) => ({ ...x, inList: e.target.value }) as GuardCondition)}>
          {!list && <option value={c.inList}>{c.inList ? fsi(c.inList) : t('conditions.pickList')}</option>}
          {lists.map((l) => (
            <option key={l.id} value={l.id}>
              {t('conditions.listOption', { name: fsi(saysIn(l.name, i18n.language)), id: fsi(l.id) })}
            </option>
          ))}
        </Select>
      </Field>
      <span className="text-xs text-muted-foreground" data-list-filters={c.inList}>
        {list ? <ListFilters list={list} fields={fields} /> : c.inList ? t('conditions.listFilter.missing') : null}
      </span>
    </>
  )
}

function ListFilters({ list, fields }: { list: GuardList; fields: readonly RegistryField[] }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const s = listSummary(list, fields)
  const parts = s.filters.map((f) =>
    [
      ...f.attributes.map((a) => t(`conditions.listFilter.${a.op}`, { field: fsi(a.label ? saysIn(a.label, i18n.language) : a.field), codes: fsi(a.codes.join(', ')) })),
      ...(f.articles ? [t('conditions.listFilter.articles', { n: f.articles })] : []),
      ...(f.categories ? [t('conditions.listFilter.categories', { n: f.categories })] : []),
    ].join(t('conditions.listFilter.and')),
  )
  const extra = [
    ...(s.include.length ? [t('conditions.listFilter.include', { lists: fsi(s.include.join(', ')) })] : []),
    ...(s.exclude.length ? [t('conditions.listFilter.exclude', { lists: fsi(s.exclude.join(', ')) })] : []),
  ]
  const text = [parts.filter(Boolean).join(t('conditions.listFilter.or')), ...extra].filter(Boolean).join(t('conditions.listFilter.and'))
  return <>{text || t('conditions.listFilter.none')}</>
}

/** A fact of the insurer's eligibility answer the codec kept as written: its field, then each test's operator and value. */
function Eligibility({ c, fields, set }: { c: EligibilityCondition; fields: readonly RegistryField[]; set: Set }) {
  const { t, i18n } = useTranslation('insurance-coverage')
  const def = fieldOfPath(fields, `$eligibility.${c.field}`)
  return (
    <>
      <Field label={t('conditions.eligibility')}>
        <span className="font-mono text-xs" data-eligibility-field={c.field}>
          {def ? <bdi>{saysIn(def.label, i18n.language)}</bdi> : <Ltr>{c.field}</Ltr>}
        </span>
      </Field>
      {eligibilityTests(c).map((k) => (
        <span key={k} className="inline-flex flex-wrap items-center gap-2" data-eligibility-test={k}>
          <Select
            value={k}
            aria-label={t('conditions.op')}
            data-input="eligibilityOp"
            onChange={(e) => set((x) => renameTest(x as EligibilityCondition, k, e.target.value as EligibilityTest))}
          >
            {testChoices(c, k).map((o) => (
              <option key={o} value={o}>
                {t(`conditions.eligibilityOp.${o}`)}
              </option>
            ))}
          </Select>
          <TestValue c={c} k={k} set={set} />
        </span>
      ))}
      {c.unit !== undefined && (
        <Field label={t('conditions.unitLabel')}>
          <span className="font-mono text-xs">
            <Ltr>{c.unit}</Ltr>
          </span>
        </Field>
      )}
    </>
  )
}

/** One test's value: a number for a bound, codes for `anyOf`, yes / no for a flag, a day (or a `$`-path) as written. */
function TestValue({ c, k, set }: { c: EligibilityCondition; k: EligibilityTest; set: Set }) {
  const { t } = useTranslation('insurance-coverage')
  const put = (v: unknown) => set((x) => ({ ...x, [k]: v }) as GuardCondition, `test:${k}`)
  if ((ELIGIBILITY_BOUNDS as readonly string[]).includes(k))
    // A cleared box writes nothing (0 would silently change what the rule matches): the bound keeps its value.
    return <NumberInput nullable value={Number(c[k])} data-input="value" onValue={(n) => n !== null && put(n)} />
  if (k === 'anyOf') return <CodesInput value={c.anyOf ?? []} title={t('conditions.codesHint')} data-input="codes" onCodes={put} />
  if (k === 'is')
    return (
      <Select value={c.is ? 'yes' : 'no'} aria-label={t('conditions.value')} data-input="flag" onChange={(e) => put(e.target.value === 'yes')}>
        {(['yes', 'no'] as const).map((v) => (
          <option key={v} value={v}>
            {t(`conditions.flag.${v}`)}
          </option>
        ))}
      </Select>
    )
  return <CodeInput value={String(c[k] ?? '')} className="w-32" data-input="day" onValue={put} />
}
