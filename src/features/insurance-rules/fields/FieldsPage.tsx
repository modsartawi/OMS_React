import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { guardDraftQuery } from '@/core/insurance-rules/api'
import type { GuardCondition, GuardRuleset } from '@/core/insurance-rules/model'
import { FIELD_SCOPES, FIELD_TYPES, type FieldScope, type RegistryField } from '@/core/insurance-rules/registry'
import { FIELDS_KEY, fieldsQuery } from '@/core/insurance-rules/registry-api'
import SaysBoth from '@/core/rules/SaysBoth'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { fieldsApi } from './api'
import DeniedCard from './DeniedCard'
import { fieldBody, fieldProblems, suggestKey, type FieldForm } from './field-form'

const FIELD = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'
const INPUT =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'
const BLANK: FieldForm = { source: '', key: '', labelEn: '', labelAr: '', scope: 'item', type: 'code', unit: '' }

/**
 * Insurance rules ▸ Fields — `/insurance-rules/fields` (BackOffice spec 3126, door 3132; oms ticket 610). The
 * registry of facts a rule or an item list can test, by scope (item · request · patient · eligibility): each
 * with its EN + AR label, key, type and unit, where HQ reads it, and what uses it. Adding a field (from a
 * source column, e.g. `ItemInfo.HouseBrand`) and retiring one — never deleting — need the master-data grant;
 * with no probe until 618, a bare 403 on either says so in words.
 */
export default function FieldsPage() {
  const { t } = useTranslation('insurance-fields')
  const fields = useQuery(fieldsQuery())
  const draft = useQuery(guardDraftQuery())

  let body
  if (fields.isError && isBareDenial(fields.error)) body = <DeniedCard hook="fields-denied" />
  else if (fields.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(fields.error, t('page.failed'))} />
  else if (!fields.data)
    body = (
      <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('page.loading')}
      </div>
    )
  else
    body = (
      <>
        {FIELD_SCOPES.map((scope) => (
          <ScopeTable key={scope} scope={scope} fields={fields.data.filter((f) => f.scope === scope)} draft={draft.data} />
        ))}
        <AddField existing={fields.data} />
      </>
    )

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5" data-fields-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.lede')}</p>
      </header>
      {body}
    </section>
  )
}

/** The lists and rules of the draft that name a field — "Used by". */
function fieldUsers(draft: GuardRuleset | undefined, key: string): string[] {
  if (!draft) return []
  const names = (cs: GuardCondition[]): boolean => cs.some((c) => (c.check === 'group' ? names(c.conditions) : c.check === 'line' && c.field === key))
  return [
    ...draft.lists.filter((l) => l.filters.some((f) => f.attributes.some((a) => a.field === key))).map((l) => l.id),
    ...draft.rules.filter((r) => names(r.when)).map((r) => r.id),
  ]
}

function ScopeTable({ scope, fields, draft }: { scope: FieldScope; fields: RegistryField[]; draft: GuardRuleset | undefined }) {
  const { t, i18n } = useTranslation('insurance-fields')
  const qc = useQueryClient()
  const retire = useMutation({
    mutationFn: (key: string) => fieldsApi.retire(key),
    onSuccess: (_d, key) => {
      notify.success(t('retire.done'), fsi(key))
      return qc.invalidateQueries({ queryKey: FIELDS_KEY })
    },
    onError: (err) => (isBareDenial(err) ? notify.error(t('retire.failed'), t('access.masterData')) : notify.apiError(t('retire.failed'), err, t('retire.failed'))),
  })
  const askRetire = async (f: RegistryField, users: number) => {
    const message = users ? t('retire.confirmUsed', { field: fsi(saysIn(f.label, i18n.language)), count: users, n: fsi(users) }) : t('retire.confirm', { field: fsi(saysIn(f.label, i18n.language)) })
    if (await confirmAction(message, t('retire.title'))) retire.mutate(f.key)
  }

  return (
    <section className="flex flex-col gap-2" data-fields-scope={scope}>
      <h2 className="text-sm font-semibold">{t(`scope.${scope}`)}</h2>
      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('page.noField')}</p>
      ) : (
        <div className="overflow-x-auto rounded-md border border-border/60">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-muted text-xs text-muted-foreground">
                <th className="px-3 py-2 text-start font-medium">{t('col.field')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('col.key')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('col.type')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('col.source')}</th>
                <th className="px-3 py-2 text-start font-medium">{t('col.usedBy')}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {fields.map((f) => {
                const users = fieldUsers(draft, f.key)
                return (
                  <tr key={f.key} className={`border-t border-border/60 ${f.retired ? 'text-muted-foreground' : ''}`} data-field-row={f.key} data-retired={f.retired || undefined}>
                    <td className="px-3 py-2">
                      <div className="flex items-start gap-2">
                        <SaysBoth says={f.label} />
                        {f.retired && <StatusBadge sev="mute">{t('retire.badge')}</StatusBadge>}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">
                      <Ltr>{f.key}</Ltr>
                    </td>
                    <td className="px-3 py-2">
                      {t(`type.${f.type}`, { defaultValue: f.type })}
                      {f.unit && (
                        <span className="text-muted-foreground">
                          {' '}
                          (<Ltr>{f.unit}</Ltr>)
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs" data-field-source="">
                      <Ltr>{f.source}</Ltr>
                    </td>
                    <td className="px-3 py-2 text-xs" data-field-users={users.length}>
                      {users.length === 0 ? (
                        <span className="text-muted-foreground">{t('page.unused')}</span>
                      ) : (
                        users.map((u) => (
                          <code key={u} className="me-1">
                            <Ltr>{u}</Ltr>
                          </code>
                        ))
                      )}
                    </td>
                    <td className="px-3 py-2 text-end">
                      {!f.retired && (
                        <Button variant="text" onClick={() => askRetire(f, users.length)} data-field-retire={f.key}>
                          {t('retire.action')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function AddField({ existing }: { existing: RegistryField[] }) {
  const { t, i18n } = useTranslation('insurance-fields')
  const qc = useQueryClient()
  const [form, setForm] = useState<FieldForm>(BLANK)
  const [keyEdited, setKeyEdited] = useState(false)
  const [tried, setTried] = useState(false)
  const problems = fieldProblems(form, existing)
  const add = useMutation({
    mutationFn: () => fieldsApi.add(fieldBody(form)),
    onSuccess: (f) => {
      notify.success(t('add.done'), fsi(saysIn(f.label, i18n.language)))
      setForm(BLANK)
      setKeyEdited(false)
      setTried(false)
      return qc.invalidateQueries({ queryKey: FIELDS_KEY })
    },
    onError: (err) => (isBareDenial(err) ? notify.error(t('add.failed'), t('access.masterData')) : notify.apiError(t('add.failed'), err, t('add.failed'))),
  })
  const set = (patch: Partial<FieldForm>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (problems.length === 0 && !add.isPending) add.mutate()
      }}
      data-field-add=""
    >
      <div>
        <h2 className="text-sm font-semibold">{t('add.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('add.hint')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <label className={FIELD}>
          {t('add.source')}
          <input
            className={INPUT}
            dir="ltr"
            placeholder={t('add.sourcePlaceholder')}
            value={form.source}
            onChange={(e) => set({ source: e.target.value, ...(keyEdited ? {} : { key: suggestKey(e.target.value) }) })}
            data-add-source=""
          />
        </label>
        <label className={FIELD}>
          {t('add.key')}
          <input
            className={INPUT}
            dir="ltr"
            value={form.key}
            onChange={(e) => {
              setKeyEdited(true)
              set({ key: e.target.value })
            }}
            data-add-key=""
          />
        </label>
        <label className={FIELD}>
          {t('add.scope')}
          <select className={INPUT} value={form.scope} onChange={(e) => set({ scope: e.target.value as FieldScope })} data-add-scope="">
            {FIELD_SCOPES.map((s) => (
              <option key={s} value={s}>
                {t(`scope.${s}`)}
              </option>
            ))}
          </select>
        </label>
        <label className={FIELD}>
          {t('add.labelEn')}
          <input className={INPUT} lang="en" dir="ltr" value={form.labelEn} onChange={(e) => set({ labelEn: e.target.value })} data-add-label-en="" />
        </label>
        <label className={FIELD}>
          {t('add.labelAr')}
          <input className={INPUT} lang="ar" dir="rtl" value={form.labelAr} onChange={(e) => set({ labelAr: e.target.value })} data-add-label-ar="" />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className={FIELD}>
            {t('add.type')}
            <select className={INPUT} value={form.type} onChange={(e) => set({ type: e.target.value as FieldForm['type'] })} data-add-type="">
              {FIELD_TYPES.map((ty) => (
                <option key={ty} value={ty}>
                  {t(`type.${ty}`)}
                </option>
              ))}
            </select>
          </label>
          <label className={FIELD}>
            {t('add.unit')}
            <input className={INPUT} dir="ltr" value={form.unit} onChange={(e) => set({ unit: e.target.value })} data-add-unit="" />
          </label>
        </div>
      </div>
      {tried && problems.length > 0 && (
        <ul className="text-xs text-danger-800" role="alert" data-add-problems="">
          {problems.map((p) => (
            <li key={p} data-problem={p}>
              {t(`problem.${p}`)}
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" variant="primary" className="w-fit" aria-disabled={add.isPending} data-add-submit="">
        {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        {t('add.submit')}
      </Button>
    </form>
  )
}
