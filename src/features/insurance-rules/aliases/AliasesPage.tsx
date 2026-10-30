import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, Loader2, Plus } from 'lucide-react'

import { apiErrorMessage, isBareDenial } from '@/core/api'
import { ByAt, DeniedCard, Loading, TD, TH } from '@/core/insurance-rules/parts'
import { insurersQuery } from '@/core/insurance-rules/registry-api'
import { saysIn } from '@/core/rules/sentence'
import { confirmAction } from '@/core/services/confirm'
import { notify } from '@/core/services/notify'
import { useSession } from '@/core/session'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, fsi } from '@/core/util/bidi'
import { aliasBody, aliasProblems, approveStanding, type AliasForm, type AliasRow } from './alias-form'
import { ALIASES_KEY, aliasesApi } from './api'

const BLANK: AliasForm = { payer: '', wrongUrl: '', canonicalUrl: '' }

/**
 * Insurance rules ▸ Aliases — `/insurance-rules/aliases` (BackOffice spec 3271 story 60, D7, D11; door 3294; oms 704).
 * A payer's quirk named once: (payer, wrong URL → canonical URL), proposed by a grant holder and approved by someone
 * else. Each URL sits in its own isolated cell, so the pair never glues two isolates; a sentence takes each through `fsi`.
 */
export default function AliasesPage() {
  const { t } = useTranslation('insurance-aliases')
  const aliases = useQuery({ queryKey: ALIASES_KEY, queryFn: () => aliasesApi.list(), retry: false })

  let body
  if (aliases.isError && isBareDenial(aliases.error)) body = <DeniedCard ns="insurance-aliases" hook="aliases-denied" />
  else if (aliases.isError) body = <ErrorBanner className="p-3" message={apiErrorMessage(aliases.error, t('page.failed'))} />
  else if (!aliases.data) body = <Loading text={t('page.loading')} />
  else
    body = (
      <>
        <AliasTable rows={aliases.data} />
        <ProposeAlias />
      </>
    )

  return (
    <section className="flex w-full max-w-6xl flex-col gap-5" data-aliases-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('page.title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('page.lede')}</p>
        <p className="mt-1 text-sm text-muted-foreground" data-aliases-never-rewritten="">
          {t('page.neverRewritten')}
        </p>
      </header>
      {body}
    </section>
  )
}

function AliasTable({ rows }: { rows: AliasRow[] }) {
  const { t } = useTranslation('insurance-aliases')
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground" data-aliases-empty="">
        {t('page.empty')}
      </p>
    )
  }
  return (
    <div className="overflow-x-auto rounded-md border border-border/60">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-muted">
            <th className={TH}>{t('col.payer')}</th>
            <th className={TH}>{t('col.wrongUrl')}</th>
            <th className={TH}>{t('col.canonicalUrl')}</th>
            <th className={TH}>{t('col.state')}</th>
            <th className={TH}>{t('col.proposedBy')}</th>
            <th className={TH}>{t('col.approvedBy')}</th>
            <th className={TH} />
          </tr>
        </thead>
        <tbody>
          {rows.map((a) => (
            <AliasLine key={a.id} alias={a} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function AliasLine({ alias }: { alias: AliasRow }) {
  const { t } = useTranslation('insurance-aliases')
  const qc = useQueryClient()
  const userId = useSession((s) => s.userId)
  const standing = approveStanding(alias, userId)
  const approve = useMutation({
    mutationFn: () => aliasesApi.approve(alias.id),
    onSuccess: () => notify.success(t('approve.done'), fsi(alias.wrongUrl)),
    onError: (err) => (isBareDenial(err) ? notify.error(t('approve.failed'), t('access.grant')) : notify.apiError(t('approve.failed'), err, t('approve.failed'))),
    onSettled: () => qc.invalidateQueries({ queryKey: ALIASES_KEY }),
  })
  const ask = async () => {
    const message = t('approve.confirm', { payer: fsi(alias.payer), wrong: fsi(alias.wrongUrl), canonical: fsi(alias.canonicalUrl) })
    if (await confirmAction(message, t('approve.title'))) approve.mutate()
  }

  return (
    <tr className="border-t border-border/60" data-alias-row={alias.id} data-alias-state={alias.state}>
      <td className={`${TD} font-mono text-xs`} data-alias-payer="">
        <Ltr>{alias.payer}</Ltr>
      </td>
      <td className={`${TD} font-mono text-xs break-all`} data-alias-wrong="">
        <Ltr>{alias.wrongUrl}</Ltr>
      </td>
      <td className={`${TD} font-mono text-xs break-all`} data-alias-canonical="">
        <Ltr>{alias.canonicalUrl}</Ltr>
      </td>
      <td className={TD}>
        <StatusBadge sev={alias.state === 'approved' ? 'ok' : 'warn'}>{t(`state.${alias.state}`)}</StatusBadge>
      </td>
      <td className={`${TD} text-xs`} data-alias-proposed-by="">
        <ByAt by={alias.proposedBy} at={alias.proposedAt} />
      </td>
      <td className={`${TD} text-xs`} data-alias-approved-by="">
        <ByAt by={alias.approvedBy} at={alias.approvedAt} />
      </td>
      <td className={`${TD} text-end`}>
        {standing === 'may' && (
          <Button variant="secondary" aria-disabled={approve.isPending} onClick={() => !approve.isPending && ask()} data-alias-approve={alias.id}>
            <Check className="h-3.5 w-3.5" aria-hidden />
            {t('approve.action')}
          </Button>
        )}
        {standing === 'ownProposal' && (
          <span className="text-xs text-muted-foreground" data-alias-why="">
            {t('approve.own')}
          </span>
        )}
      </td>
    </tr>
  )
}

function ProposeAlias() {
  const { t, i18n } = useTranslation('insurance-aliases')
  const qc = useQueryClient()
  const insurers = useQuery(insurersQuery())
  const [form, setForm] = useState<AliasForm>(BLANK)
  const [tried, setTried] = useState(false)
  const problems = aliasProblems(form)
  const propose = useMutation({
    mutationFn: () => aliasesApi.propose(aliasBody(form)),
    onSuccess: (a) => {
      notify.success(t('form.done'), fsi(a.wrongUrl))
      setForm(BLANK)
      setTried(false)
      return qc.invalidateQueries({ queryKey: ALIASES_KEY })
    },
    onError: (err) => (isBareDenial(err) ? notify.error(t('form.failed'), t('access.grant')) : notify.apiError(t('form.failed'), err, t('form.failed'))),
  })
  const set = (patch: Partial<AliasForm>) => setForm((f) => ({ ...f, ...patch }))

  return (
    <form
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
      onSubmit={(e) => {
        e.preventDefault()
        setTried(true)
        if (problems.length === 0 && !propose.isPending) propose.mutate()
      }}
      data-alias-form=""
    >
      <div>
        <h2 className="text-sm font-semibold">{t('form.title')}</h2>
        <p className="text-xs text-muted-foreground">{t('form.hint')}</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label={t('form.payer')}>
          <Select value={form.payer} onChange={(e) => set({ payer: e.target.value })} data-alias-form-payer="">
            <option value="">{t('form.payerChoose')}</option>
            {(insurers.data ?? []).map((i) => (
              <option key={i.payer} value={i.payer}>
                {fsi(formatPair(i.payer, i.name ? saysIn(i.name, i18n.language) : ''))}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('form.wrongUrl')}>
          <Input dir="ltr" placeholder={t('form.wrongPlaceholder')} value={form.wrongUrl} onChange={(e) => set({ wrongUrl: e.target.value })} data-alias-form-wrong="" />
        </Field>
        <Field label={t('form.canonicalUrl')}>
          <Input dir="ltr" placeholder={t('form.canonicalPlaceholder')} value={form.canonicalUrl} onChange={(e) => set({ canonicalUrl: e.target.value })} data-alias-form-canonical="" />
        </Field>
      </div>
      {insurers.isError && (
        <p className="text-xs text-danger-800" role="alert" data-alias-form-no-insurers="">
          {apiErrorMessage(insurers.error, t('form.payersFailed'))}
        </p>
      )}
      {tried && problems.length > 0 && (
        <ul className="text-xs text-danger-800" role="alert" data-alias-form-problems="">
          {problems.map((p) => (
            <li key={p} data-problem={p}>
              {t(`problem.${p}`)}
            </li>
          ))}
        </ul>
      )}
      <Button type="submit" variant="primary" className="w-fit" aria-disabled={propose.isPending} data-alias-form-submit="">
        {propose.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
        {t('form.submit')}
      </Button>
    </form>
  )
}
