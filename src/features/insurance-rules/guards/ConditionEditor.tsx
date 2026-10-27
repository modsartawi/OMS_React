import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { blockKey, fieldIssues, type ChecksIndex } from '@/core/insurance-rules/checks'
import {
  PALETTE,
  addCondition,
  addDaysFor,
  canAddGroup,
  listOfAlias,
  newCondition,
  removeCondition,
  removeDaysFor,
  setDaysFor,
  toggleNarrow,
  toggleNot,
  updateCondition,
  withListFilter,
  type ConditionPath,
} from '@/core/insurance-rules/guard-edit'
import { HISTORY_NARROWS, type GuardCheck, type GuardCondition, type GuardList, type GuardMatch, type GuardRule, type HistoryCondition, type LineCondition, type SupplyCondition } from '@/core/insurance-rules/model'
import type { RegistryField } from '@/core/insurance-rules/registry'
import { fieldsQuery, keyedListsQuery } from '@/core/insurance-rules/registry-api'
import { dateFields, factFields, factKind, factPath, fieldOfPath, lineFields, unitKey } from '@/core/insurance-rules/registry-facts'
import { saysIn } from '@/core/rules/sentence'
import Chip from '@/core/ui/Chip'
import IconButton from '@/core/ui/IconButton'
import { fsi } from '@/core/util/bidi'
import { CodeInput, CodesInput, Field, Issues, NumberInput, Select } from '@/core/insurance-rules/controls'

// The IF of the guard editor (ticket 608): the rule's conditions as a tree — All of / Any of groups nested up
// to three levels, NOT on any condition — and a palette at the foot of every list to add a block. The pure
// edits are `@/core/insurance-rules/guard-edit`; a 4th group level is offered disabled, never added.

export type RuleEdit = (fn: (r: GuardRule) => GuardRule, coalesce?: string) => void

interface Ctx {
  rule: GuardRule
  lists: readonly GuardList[]
  edit: RuleEdit
  checks: ChecksIndex
}

const pathKey = (p: ConditionPath) => p.join('.')

export default function ConditionEditor(ctx: Ctx) {
  const { t } = useTranslation('insurance-guards')
  return (
    <div className="flex flex-col gap-2" data-condition-root="">
      <p className="text-xs text-muted-foreground">{t('editor.group.top')}</p>
      {ctx.rule.when.length === 0 && (
        <p className="rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground" data-conditions-empty="">
          {t('editor.group.empty')}
        </p>
      )}
      <ConditionList ctx={ctx} list={ctx.rule.when} parent={[]} />
    </div>
  )
}

function ConditionList({ ctx, list, parent }: { ctx: Ctx; list: readonly GuardCondition[]; parent: ConditionPath }) {
  return (
    <>
      {list.length > 0 && (
        <ul className="flex flex-col gap-2">
          {list.map((c, i) => {
            const path = [...parent, i]
            return (
              <li key={i}>{c.check === 'group' ? <GroupBox ctx={ctx} c={c} path={path} /> : <BlockRow ctx={ctx} c={c} path={path} />}</li>
            )
          })}
        </ul>
      )}
      <AddCondition ctx={ctx} parent={parent} />
    </>
  )
}

/** "+ Add a condition…": the palette, by group; a group past the 3rd level is offered disabled. */
function AddCondition({ ctx, parent }: { ctx: Ctx; parent: ConditionPath }) {
  const { t } = useTranslation('insurance-guards')
  const groupOk = canAddGroup(ctx.rule.when, parent)
  return (
    <div className="flex items-center gap-2">
      <Select
        value=""
        aria-label={t('editor.group.addAria')}
        data-add-condition={pathKey(parent)}
        className="w-64"
        onChange={(e) => {
          const check = e.target.value as GuardCheck
          if (!check) return
          ctx.edit((r) => ({ ...r, when: addCondition(r.when, parent, newCondition(check)) }))
        }}
      >
        <option value="">{t('editor.group.add')}</option>
        {PALETTE.map((g) => (
          <optgroup key={g.group} label={t(`editor.palette.${g.group}`)}>
            {g.checks.map((check) => (
              <option key={check} value={check} disabled={check === 'group' && !groupOk}>
                {check === 'group' && !groupOk ? t('editor.group.tooDeep') : t(`editor.block.${check}`)}
              </option>
            ))}
          </optgroup>
        ))}
      </Select>
      {!groupOk && (
        <span className="text-xs text-muted-foreground" data-too-deep="">
          {t('editor.group.tooDeepHint')}
        </span>
      )}
    </div>
  )
}

function NotToggle({ ctx, c, path }: { ctx: Ctx; c: GuardCondition; path: ConditionPath }) {
  const { t } = useTranslation('insurance-guards')
  return (
    <button
      type="button"
      aria-pressed={c.not === true}
      title={t('editor.group.notHint')}
      data-not-toggle={pathKey(path)}
      onClick={() => ctx.edit((r) => ({ ...r, when: toggleNot(r.when, path) }))}
      className={`h-7 rounded-full border px-3 font-mono text-[11px] font-semibold ${
        c.not ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border bg-card text-muted-foreground hover:bg-accent'
      }`}
    >
      {t('editor.group.not')}
    </button>
  )
}

function RemoveButton({ ctx, path, label }: { ctx: Ctx; path: ConditionPath; label: string }) {
  return (
    <IconButton
      variant="danger"
      size="compact"
      label={label}
      data-remove={pathKey(path)}
      onClick={() => ctx.edit((r) => ({ ...r, when: removeCondition(r.when, path) }))}
    >
      <X className="h-3.5 w-3.5" aria-hidden />
    </IconButton>
  )
}

function GroupBox({ ctx, c, path }: { ctx: Ctx; c: Extract<GuardCondition, { check: 'group' }>; path: ConditionPath }) {
  const { t } = useTranslation('insurance-guards')
  const issues = ctx.checks.blocks.get(blockKey('when', path)) ?? []
  return (
    <div
      className={`flex flex-col gap-2 rounded-e-md border-s-[3px] bg-muted/40 p-2 ${issues.length ? 'border-danger' : 'border-primary'}`}
      data-group={pathKey(path)}
      data-mode={c.mode}
      data-not={c.not ? 'true' : 'false'}
      data-level={path.length}
    >
      <div className="flex flex-wrap items-center gap-2">
        <NotToggle ctx={ctx} c={c} path={path} />
        <div className="inline-flex gap-1" role="group" aria-label={t('editor.group.mode')}>
          {(['all', 'any'] as const).map((m) => (
            <Chip
              key={m}
              on={c.mode === m}
              data-mode-pick={m}
              onClick={() => ctx.edit((r) => ({ ...r, when: updateCondition(r.when, path, (g) => (g.check === 'group' && g.mode !== m ? { ...g, mode: m } : g)) }))}
            >
              {t(`editor.group.${m}`)}
            </Chip>
          ))}
        </div>
        <span className="text-xs text-muted-foreground">{t(`editor.group.${c.mode}Hint`)}</span>
        <span className="ms-auto">
          <RemoveButton ctx={ctx} path={path} label={t('editor.group.removeGroup')} />
        </span>
      </div>
      <Issues issues={issues} hook={pathKey(path)} />
      <div className="ps-2">
        <ConditionList ctx={ctx} list={c.conditions} parent={path} />
      </div>
    </div>
  )
}

function BlockRow({ ctx, c, path }: { ctx: Ctx; c: Exclude<GuardCondition, { check: 'group' }>; path: ConditionPath }) {
  const { t } = useTranslation('insurance-guards')
  const issues = ctx.checks.blocks.get(blockKey('when', path)) ?? []
  return (
    <div
      className={`flex flex-col gap-1.5 rounded-md border bg-card p-2 ${issues.length ? 'border-danger-border' : 'border-border/60'}`}
      data-block={pathKey(path)}
      data-check={c.check}
      data-not={c.not ? 'true' : 'false'}
    >
      <div className="flex flex-wrap items-center gap-2">
        <NotToggle ctx={ctx} c={c} path={path} />
        <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium" data-block-label="">
          {t(`editor.block.${c.check}`)}
        </span>
        <div className="flex flex-1 flex-wrap items-center gap-x-3 gap-y-1.5">
          <BlockFields ctx={ctx} c={c} path={path} />
        </div>
        <RemoveButton ctx={ctx} path={path} label={t('editor.group.remove')} />
      </div>
      <Issues issues={issues} hook={pathKey(path)} />
    </div>
  )
}

/** The typed fields of one block, each with its unit. */
function BlockFields({ ctx, c, path }: { ctx: Ctx; c: Exclude<GuardCondition, { check: 'group' }>; path: ConditionPath }) {
  const { t, i18n } = useTranslation('insurance-guards')
  const issues = ctx.checks.blocks.get(blockKey('when', path))
  const bad = (field: string) => fieldIssues(issues, field).length > 0
  const key = (field: string) => `${pathKey(path)}:${field}`
  /** The block replaced by `fn(it)`; typing into one field coalesces into one step. */
  const set = <C extends GuardCondition = typeof c>(fn: (x: C) => GuardCondition, field?: string) =>
    ctx.edit((r) => ({ ...r, when: updateCondition(r.when, path, (x) => fn(x as C)) }), field ? key(field) : undefined)
  const listName = (l: GuardList) => fsi(saysIn(l.name, i18n.language))
  const unit = (u: string) => t(`editor.unit.${u}`)
  // 617: the facts, the line's numbers and the days to compare with are the Fields registry's (610), so an
  // eligibility fact the registry holds appears here at once.
  const fields = useQuery(fieldsQuery()).data ?? []
  const fieldName = (f: RegistryField) => fsi(saysIn(f.label, i18n.language))
  const unitOf = (f: RegistryField | undefined) => {
    const k = unitKey(f?.unit)
    return k ? unit(k) : (f?.unit ?? undefined)
  }

  /** Point the block at a ruleset list: the rule gains a filter for it, the block names the filter's id. */
  const pickList = (listId: string, write: (x: typeof c, alias: string) => GuardCondition) =>
    ctx.edit((r) => {
      const { rule, alias } = withListFilter(r, listId)
      return { ...rule, when: updateCondition(rule.when, path, (x) => write(x as typeof c, alias)) }
    })

  const matchSelect = (match: GuardMatch, write: (m: GuardMatch) => void) => {
    const listId = match.startsWith('list:') ? listOfAlias(ctx.rule, match.slice(5)) : null
    return (
      <Field label={t('editor.field.match')}>
        <Select
          value={listId ? `list:${listId}` : match}
          invalid={bad('match')}
          data-input="match"
          onChange={(e) => {
            const v = e.target.value
            if (v.startsWith('list:')) {
              const id = v.slice(5)
              pickList(id, (x, alias) => ({ ...x, match: `list:${alias}` }) as GuardCondition)
            } else write(v as GuardMatch)
          }}
        >
          {(['sameItem', 'sameKind', 'sameClass'] as const).map((m) => (
            <option key={m} value={m}>
              {t(`editor.match.${m}`)}
            </option>
          ))}
          {ctx.lists.map((l) => (
            <option key={l.id} value={`list:${l.id}`}>
              {t('editor.match.list', { list: listName(l) })}
            </option>
          ))}
        </Select>
      </Field>
    )
  }

  const checkbox = (field: string, checked: boolean, write: (v: boolean) => void) => (
    <label className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      <input type="checkbox" checked={checked} data-input={field} onChange={(e) => write(e.target.checked)} />
      {t(`editor.field.${field}`)}
    </label>
  )

  switch (c.check) {
    case 'history':
      return (
        <>
          {matchSelect(c.match, (m) => set((x) => ({ ...x, match: m })))}
          <Field label={t('editor.field.measure')}>
            <Select value={c.measure} data-input="measure" onChange={(e) => set((x) => ({ ...x, measure: e.target.value as typeof c.measure }))}>
              {(['dispenses', 'quantity', 'distinctStores'] as const).map((m) => (
                <option key={m} value={m}>
                  {t(`editor.measure.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={t('editor.field.atLeast')}>
            <NumberInput value={c.atLeast} invalid={bad('atLeast')} data-input="atLeast" onValue={(n) => set((x) => ({ ...x, atLeast: n }), 'atLeast')} />
          </Field>
          <Field label={t('editor.field.windowDays')} unit={unit('days')}>
            <NumberInput value={c.windowDays} invalid={bad('windowDays')} data-input="windowDays" onValue={(n) => set((x) => ({ ...x, windowDays: n }), 'windowDays')} />
          </Field>
          {checkbox('includeThisLine', c.includeThisLine, (v) => set((x) => ({ ...x, includeThisLine: v })))}
          {c.match === 'sameClass' && checkbox('excludeSameKind', c.excludeSameKind === true, (v) => set((x) => ({ ...x, excludeSameKind: v })))}
          <span className="inline-flex flex-wrap items-center gap-2 text-xs text-muted-foreground" data-narrow-to={(c.narrowTo ?? []).join(',')}>
            {t('editor.field.narrowTo')}
            {HISTORY_NARROWS.map((s) => (
              <label key={s} className="inline-flex items-center gap-1">
                <input type="checkbox" checked={(c.narrowTo ?? []).includes(s)} data-narrow={s} onChange={() => set((x: HistoryCondition) => toggleNarrow(x, s))} />
                {t(`editor.narrow.${s}`)}
              </label>
            ))}
          </span>
        </>
      )
    case 'supply': {
      const mode = c.eligibleDaysBeforeDue !== undefined ? 'daysBeforeDue' : 'consumedBelow'
      return (
        <>
          {matchSelect(c.match, (m) => set((x) => ({ ...x, match: m })))}
          <Field label={t('editor.field.supplyMode')}>
            <Select
              value={mode}
              data-input="supplyMode"
              onChange={(e) =>
                set((x: SupplyCondition) => {
                  const { eligibleDaysBeforeDue: _d, consumedBelow: _c, ...rest } = x
                  void _d
                  void _c
                  return e.target.value === 'daysBeforeDue' ? { ...rest, eligibleDaysBeforeDue: 10 } : { ...rest, consumedBelow: 0.75 }
                })
              }
            >
              <option value="daysBeforeDue">{t('editor.supplyMode.daysBeforeDue')}</option>
              <option value="consumedBelow">{t('editor.supplyMode.consumedBelow')}</option>
            </Select>
          </Field>
          {mode === 'daysBeforeDue' ? (
            <NumberInput
              value={c.eligibleDaysBeforeDue ?? 0}
              invalid={bad('eligibleDaysBeforeDue')}
              aria-label={t('editor.supplyMode.daysBeforeDue')}
              data-input="eligibleDaysBeforeDue"
              onValue={(n) => set((x) => ({ ...x, eligibleDaysBeforeDue: n }), 'eligibleDaysBeforeDue')}
            />
          ) : (
            <NumberInput
              value={Math.round((c.consumedBelow ?? 0) * 100)}
              invalid={bad('consumedBelow')}
              aria-label={t('editor.supplyMode.consumedBelow')}
              data-input="consumedBelow"
              onValue={(n) => set((x) => ({ ...x, consumedBelow: n / 100 }), 'consumedBelow')}
            />
          )}
          <span className="text-xs text-muted-foreground">{unit(mode === 'daysBeforeDue' ? 'days' : 'percent')}</span>
          {mode === 'daysBeforeDue' && (
            <span className="inline-flex flex-wrap items-center gap-2" data-days-for="">
              {(c.eligibleDaysBeforeDueFor ?? []).map((f, i) => (
                <span key={i} className="inline-flex items-center gap-1 text-xs text-muted-foreground" data-days-for-row={i}>
                  <NumberInput
                    value={f.value}
                    invalid={bad(`eligibleDaysBeforeDueFor.${i}`)}
                    aria-label={t('editor.daysFor.days')}
                    data-input={`daysFor.${i}.value`}
                    onValue={(n) => set((x: SupplyCondition) => setDaysFor(x, i, { value: n }), `daysFor.${i}`)}
                  />
                  {t('editor.daysFor.for')}
                  <Select value={f.list} aria-label={t('editor.daysFor.list')} data-input={`daysFor.${i}.list`} onChange={(e) => set((x: SupplyCondition) => setDaysFor(x, i, { list: e.target.value }))}>
                    {!ctx.lists.some((l) => l.id === f.list) && <option value={f.list}>{fsi(f.list)}</option>}
                    {ctx.lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {listName(l)}
                      </option>
                    ))}
                  </Select>
                  <IconButton variant="danger" size="compact" label={t('editor.daysFor.remove')} data-days-for-remove={i} onClick={() => set((x: SupplyCondition) => removeDaysFor(x, i))}>
                    <X className="h-3.5 w-3.5" aria-hidden />
                  </IconButton>
                </span>
              ))}
              {ctx.lists.length > 0 && (
                <button type="button" className="text-xs text-primary hover:underline" data-days-for-add="" onClick={() => set((x: SupplyCondition) => addDaysFor(x, ctx.lists[0].id))}>
                  {t('editor.daysFor.add')}
                </button>
              )}
            </span>
          )}
          <Field label={t('editor.field.surplusDays')} unit={unit('days')}>
            <NumberInput
              value={c.accumulate?.surplusDays ?? 0}
              data-input="surplusDays"
              onValue={(n) => set((x: SupplyCondition) => ({ ...x, accumulate: { overDays: x.accumulate?.overDays ?? 90, surplusDays: n } }), 'surplusDays')}
            />
          </Field>
          <Field label={t('editor.field.overDays')} unit={unit('days')}>
            <NumberInput
              value={c.accumulate?.overDays ?? 0}
              data-input="overDays"
              onValue={(n) => set((x: SupplyCondition) => ({ ...x, accumulate: { surplusDays: x.accumulate?.surplusDays ?? 10, overDays: n } }), 'overDays')}
            />
          </Field>
          <Field label={t('editor.field.assumeDays')} unit={unit('days')}>
            <NumberInput value={c.unknownSupply?.assumeDays ?? 0} data-input="assumeDays" onValue={(n) => set((x) => ({ ...x, unknownSupply: { assumeDays: n } }), 'assumeDays')} />
          </Field>
        </>
      )
    }
    case 'volume':
      return (
        <>
          <Field label={t('editor.field.by')}>
            <Select value={c.by} data-input="by" onChange={(e) => set((x) => ({ ...x, by: e.target.value as typeof c.by }))}>
              <option value="pharmacist">{t('editor.by.pharmacist')}</option>
              <option value="store">{t('editor.by.store')}</option>
            </Select>
          </Field>
          {matchSelect(c.match, (m) => set((x) => ({ ...x, match: m })))}
          <Field label={t('editor.field.atLeast')}>
            <NumberInput value={c.atLeast} invalid={bad('atLeast')} data-input="atLeast" onValue={(n) => set((x) => ({ ...x, atLeast: n }), 'atLeast')} />
          </Field>
          <Field label={t('editor.field.window')}>
            <Select value={c.window} data-input="window" onChange={(e) => set((x) => ({ ...x, window: e.target.value as typeof c.window }))}>
              {(['day', 'week', 'month'] as const).map((w) => (
                <option key={w} value={w}>
                  {t(`editor.window.${w}`)}
                </option>
              ))}
            </Select>
          </Field>
          {checkbox('includeThisLine', c.includeThisLine, (v) => set((x) => ({ ...x, includeThisLine: v })))}
        </>
      )
    case 'line': {
      const mode = c.inList !== undefined ? 'inList' : c.after !== undefined ? 'after' : c.below !== undefined ? 'below' : 'above'
      const numbers = lineFields(fields)
      const fieldUnit = unitOf(numbers.find((f) => f.key === c.field))
      return (
        <>
          <Field label={t('editor.field.lineMode')}>
            <Select
              value={mode}
              data-input="lineMode"
              onChange={(e) => {
                const m = e.target.value
                if (m === 'inList') {
                  const first = ctx.lists[0]?.id
                  if (first) pickList(first, (x, alias) => ({ check: 'line', ...(x.not ? { not: true } : {}), inList: alias }))
                  else set((x) => ({ check: 'line', ...(x.not ? { not: true } : {}), inList: '' }))
                } else if (m === 'after') set((x) => ({ check: 'line', ...(x.not ? { not: true } : {}), field: 'supplyEndsOn', after: '$eligibility.coverage.periodEnd' }))
                else set((x: LineCondition) => ({ check: 'line', ...(x.not ? { not: true } : {}), field: numbers.some((f) => f.key === x.field) ? x.field : 'daysSupply', [m]: 90 }))
              }}
            >
              {(['above', 'below', 'after', 'inList'] as const).map((m) => (
                <option key={m} value={m}>
                  {t(`editor.lineMode.${m}`)}
                </option>
              ))}
            </Select>
          </Field>
          {mode === 'inList' ? (
            <Field label={t('editor.field.list')}>
              <Select
                value={listOfAlias(ctx.rule, c.inList ?? '')}
                invalid={bad('inList')}
                data-input="inList"
                onChange={(e) => pickList(e.target.value, (x, alias) => ({ ...x, inList: alias }) as GuardCondition)}
              >
                {!ctx.lists.some((l) => l.id === listOfAlias(ctx.rule, c.inList ?? '')) && <option value="">{t('editor.field.pickList')}</option>}
                {ctx.lists.map((l) => (
                  <option key={l.id} value={l.id}>
                    {listName(l)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : mode === 'after' ? (
            <Field label={t('editor.lineField.supplyEndsOn')}>
              <Select value={c.after ?? ''} invalid={bad('after')} data-input="after" onChange={(e) => set((x) => ({ ...x, after: e.target.value }))}>
                {!dateFields(fields).some((f) => factPath(f) === c.after) && <option value={c.after ?? ''}>{fsi(c.after ?? '')}</option>}
                {dateFields(fields).map((f) => (
                  <option key={f.key} value={factPath(f)} data-scope={f.scope}>
                    {fieldName(f)}
                  </option>
                ))}
              </Select>
            </Field>
          ) : (
            <>
              <Field label={t('editor.field.lineField')}>
                <Select value={c.field ?? 'daysSupply'} invalid={bad('field')} data-input="field" onChange={(e) => set((x) => ({ ...x, field: e.target.value }))}>
                  {!numbers.some((f) => f.key === (c.field ?? 'daysSupply')) && <option value={c.field ?? 'daysSupply'}>{fsi(c.field ?? 'daysSupply')}</option>}
                  {numbers.map((f) => (
                    <option key={f.key} value={f.key}>
                      {fieldName(f)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('editor.field.value')} unit={fieldUnit}>
                <NumberInput
                  value={(mode === 'below' ? c.below : c.above) ?? 0}
                  invalid={bad(mode)}
                  data-input="lineValue"
                  onValue={(n) => set((x) => ({ ...x, [mode]: n }), mode)}
                />
              </Field>
            </>
          )}
        </>
      )
    }
    case 'sfda': {
      const kind = c.status === 'notMarketed' ? 'notMarketed' : c.priceAbove !== undefined ? 'priceAbove' : 'packMismatch'
      return (
        <>
          <Select
            value={kind}
            aria-label={t('editor.block.sfda')}
            data-input="sfda"
            onChange={(e) => {
              const k = e.target.value
              const base = { check: 'sfda' as const, ...(c.not ? { not: true } : {}) }
              set(() => (k === 'notMarketed' ? { ...base, status: 'notMarketed' } : k === 'priceAbove' ? { ...base, priceAbove: 0 } : { ...base, packMismatch: true }))
            }}
          >
            {(['notMarketed', 'priceAbove', 'packMismatch'] as const).map((k) => (
              <option key={k} value={k}>
                {t(`editor.sfda.${k}`)}
              </option>
            ))}
          </Select>
          {kind === 'priceAbove' && (
            <NumberInput
              value={c.priceAbove ?? 0}
              invalid={bad('priceAbove')}
              aria-label={t('editor.sfda.priceAbove')}
              data-input="priceAbove"
              onValue={(n) => set((x) => ({ ...x, priceAbove: n }), 'priceAbove')}
            />
          )}
          {kind === 'priceAbove' && <span className="text-xs text-muted-foreground">{unit('sar')}</span>}
        </>
      )
    }
    case 'formulary': {
      const kind = c.indication ?? c.edit ?? 'notListed'
      return (
        <Select
          value={kind}
          aria-label={t('editor.block.formulary')}
          data-input="formulary"
          onChange={(e) => {
            const k = e.target.value
            const base = { check: 'formulary' as const, ...(c.not ? { not: true } : {}) }
            set(() => (k === 'listed' || k === 'notListed' ? { ...base, indication: k } : { ...base, edit: k as 'QL' | 'PA' | 'AGE' | 'G' }))
          }}
        >
          {(['notListed', 'listed', 'QL', 'PA', 'AGE', 'G'] as const).map((k) => (
            <option key={k} value={k}>
              {t(`editor.formulary.${k}`)}
            </option>
          ))}
        </Select>
      )
    }
    case 'patient':
    case 'policy':
      return (
        <Field label={t(`editor.field.${c.check}List`)}>
          <KeyedListSelect kind={c.check} value={c.inList} invalid={bad('inList')} onPick={(id) => set((x) => ({ ...x, inList: id }))} />
        </Field>
      )
    case 'fact': {
      const def = fieldOfPath(fields, c.path)
      const isNumber = def ? factKind(def) === 'number' : typeof c.value === 'number'
      const offered = factFields(fields)
      return (
        <>
          <Field label={t('editor.field.fact')}>
            <Select
              value={c.path}
              data-input="fact"
              onChange={(e) => {
                const next = fieldOfPath(fields, e.target.value)
                set((x) => ({ ...x, path: e.target.value, ...(next && factKind(next) === 'codes' ? { op: 'anyOf', value: [] } : { op: 'atLeast', value: 0 }) }))
              }}
            >
              {!offered.some((f) => factPath(f) === c.path) && <option value={c.path}>{fsi(c.path)}</option>}
              {(['patient', 'request', 'eligibility', 'item'] as const).map((scope) => {
                const inScope = offered.filter((f) => f.scope === scope)
                return inScope.length ? (
                  <optgroup key={scope} label={t(`editor.factScope.${scope}`)}>
                    {inScope.map((f) => (
                      <option key={f.key} value={factPath(f)} data-scope={scope}>
                        {fieldName(f)}
                      </option>
                    ))}
                  </optgroup>
                ) : null
              })}
            </Select>
          </Field>
          <Field label={t('editor.field.op')}>
            <Select value={c.op} data-input="op" onChange={(e) => set((x) => ({ ...x, op: e.target.value as typeof c.op }))}>
              {(isNumber ? (['atLeast', 'below'] as const) : (['anyOf', 'noneOf'] as const)).map((o) => (
                <option key={o} value={o}>
                  {t(`editor.factOp.${o}`)}
                </option>
              ))}
            </Select>
          </Field>
          {isNumber ? (
            <Field label={t('editor.field.value')} unit={unitOf(def)}>
              <NumberInput value={Number(c.value)} invalid={bad('value')} data-input="value" onValue={(n) => set((x) => ({ ...x, value: n }), 'value')} />
            </Field>
          ) : (
            <Field label={t('editor.field.codes')}>
              <CodesInput
                value={Array.isArray(c.value) ? c.value : [String(c.value)]}
                invalid={bad('value')}
                title={t('editor.codesHint')}
                placeholder="E11*"
                data-input="codes"
                onCodes={(codes) => set((x) => ({ ...x, value: codes }), 'value')}
              />
            </Field>
          )}
        </>
      )
    }
    case 'formula':
      return (
        <Field label={t('editor.field.formula')}>
          <CodeInput
            value={c.formula}
            invalid={bad('formula')}
            className="w-96"
            title={t('editor.formulaHint')}
            data-input="formula"
            onValue={(s) => set((x) => ({ ...x, formula: s }), 'formula')}
          />
        </Field>
      )
    default:
      return null
  }
}

/** A patient or policy list, picked by id from the lists (610's doors); a list not among them stays named by its id. */
export function KeyedListSelect({ kind, value, invalid, onPick }: { kind: 'patient' | 'policy'; value: string; invalid: boolean; onPick: (id: string) => void }) {
  const { t, i18n } = useTranslation('insurance-guards')
  const lists = useQuery(keyedListsQuery(kind)).data ?? []
  return (
    <Select value={value} invalid={invalid} data-input="inList" onChange={(e) => onPick(e.target.value)}>
      {!lists.some((l) => l.id === value) && <option value={value}>{value ? fsi(value) : t('editor.field.pickList')}</option>}
      {lists.map((l) => (
        <option key={l.id} value={l.id}>
          {fsi(saysIn(l.name, i18n.language))}
        </option>
      ))}
    </Select>
  )
}

