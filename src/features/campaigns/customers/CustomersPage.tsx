import { type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2, Search } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { RuleMember, RuleMemberKey } from '@/core/models/rule-campaign'
import { ruleMembersQuery } from '@/core/rules/api'
import { ruleCustomerPath } from '@/core/rules/campaign-state'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { formatPair } from '@/core/util/bidi'
import MemberView from './MemberView'
import { MEMBER_KEYS, memberQueryFromParams, memberQueryToParams } from './member-query'

/**
 * Campaigns ▸ Customers (ticket 519, BackOffice spec 2737): support finds a member by loyalty id or
 * mobile and reads the rule engine's view of them — the coupon wallet, the points balance (spend
 * and tier points, and what is pending), and the profile-scope budgets they have used. Read-only,
 * and only that view: the member's own record is Loyalty's screen, not this one.
 *
 * Doors `RuleCampaign/Members…` (PROVISIONAL, BackOffice 2754 and 2744). No access probe on the leaf
 * yet: the doors fail closed on the server; ticket 520 adds the probe.
 */
export default function CustomersPage() {
  const { t } = useTranslation('rule-customers')
  const navigate = useNavigate()
  const { query, update } = useUrlQuery(memberQueryFromParams, memberQueryToParams)
  const members = useQuery(ruleMembersQuery(query.by, query.value))

  const find = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    const by = form.get('by') as RuleMemberKey
    const value = String(form.get('value') ?? '').trim()
    // The same look-up again is a fresh read: a till may just have moved the member's counters.
    if (by === query.by && value === query.value) void members.refetch()
    else if (value) update(() => ({ by, value }))
  }
  // A mobile shared by several members: picking one looks it up by its loyalty id — pushed, not
  // replaced, so Back returns to the members the mobile matched.
  const pick = (m: RuleMember) => navigate(ruleCustomerPath(m.id))

  const found = members.data ?? []

  return (
    <section className="flex w-full max-w-6xl flex-col gap-4" data-customers="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      {/* Keyed by the look-up asked, so Back or a coupon's member link refills the form. */}
      <form key={`${query.by}:${query.value}`} className="flex flex-wrap items-end gap-2" onSubmit={find} data-customers-form="">
        <Field label={t('form.by')}>
          <Select name="by" defaultValue={query.by} data-customers-by="">
            {MEMBER_KEYS.map((k) => (
              <option key={k} value={k}>
                {t(`form.key.${k}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('form.value')}>
          <Input
            name="value"
            dir="ltr"
            autoComplete="off"
            className="w-56 font-mono"
            defaultValue={query.value}
            data-customers-value=""
          />
        </Field>
        <Button type="submit" variant="secondary" data-customers-find="">
          <Search className="size-3.5" aria-hidden />
          {t('form.find')}
        </Button>
      </form>

      {!query.value ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-customers-empty="">
          {t('form.hint')}
        </p>
      ) : members.isPending ? (
        <p className="inline-flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t('result.loading')}
        </p>
      ) : members.isError ? (
        <div data-customers-refusal="">
          <ErrorBanner className="p-2.5" title={t('result.failedTitle')} message={apiErrorMessage(members.error, t('result.failed'))} />
        </div>
      ) : found.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground" data-customers-none="">
          {t(`result.none.${query.by}`)}
        </p>
      ) : found.length === 1 ? (
        <MemberView member={found[0]} />
      ) : (
        <div className="flex flex-col gap-2" data-customers-several={found.length}>
          <p className="text-sm text-muted-foreground">{t('result.several')}</p>
          <ul className="flex flex-col gap-1">
            {found.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  className="flex w-full flex-wrap items-center gap-3 rounded-md border border-border bg-card px-3 py-2 text-start text-sm hover:border-primary/50"
                  onClick={() => pick(m)}
                  data-customers-pick={m.id}
                >
                  <bdi className="font-medium">{m.name}</bdi>
                  <span className="font-mono text-muted-foreground">
                    <Ltr>{formatPair(m.id, m.mobile)}</Ltr>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
