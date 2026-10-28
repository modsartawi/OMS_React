import { useEffect, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { Loader2, Search } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import { loyGroupName } from '@/core/loy-groups/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { LOOKUP_MOBILE_PARAM, lookupMobileOf, mobileGroupsQuery } from './api'

const FIELD_ID = 'loy-groups-lookup-mobile'

/**
 * Find a mobile (oms ticket 634; door BackOffice 3176) — "why did this customer get that offer". Type a
 * mobile in any spelling and see every group it is in, inactive ones marked, each opening its group page.
 *
 * The searched mobile sits in the URL (`?mobile=`), beside the list's `?scope=`, so a refresh repeats the
 * search. The view grant is enough: the page's `ScreenGate` already holds it.
 */
export default function MobileLookup() {
  const { t, i18n } = useTranslation('loy-groups')
  const [params, setParams] = useSearchParams()
  const mobile = lookupMobileOf(params)
  const [typed, setTyped] = useState(mobile)
  // Back, or a pasted link, moves the URL under the field: follow it.
  useEffect(() => setTyped(mobile), [mobile])

  const lookup = useQuery(mobileGroupsQuery(mobile))

  const writeMobile = (next: string) => {
    const p = new URLSearchParams(params)
    if (next === '') p.delete(LOOKUP_MOBILE_PARAM)
    else p.set(LOOKUP_MOBILE_PARAM, next)
    setParams(p, { replace: true })
  }
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const next = typed.trim()
    // The same mobile again is a deliberate re-ask: refetch rather than no-op on an unchanged URL.
    if (next !== '' && next === mobile) void lookup.refetch()
    else writeMobile(next)
  }

  return (
    <section className="flex flex-col gap-2 rounded-md border border-border/60 p-3" data-loy-groups-lookup="">
      <form className="flex flex-wrap items-center gap-2" onSubmit={submit}>
        <label className="text-sm font-medium text-foreground" htmlFor={FIELD_ID}>
          {t('lookup.label')}
        </label>
        <Input
          id={FIELD_ID}
          type="search"
          dir="ltr"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('lookup.placeholder')}
          autoComplete="off"
          wrapperClassName="w-64"
          data-lookup-input=""
        />
        <Button type="submit" disabled={lookup.isFetching} data-lookup-submit="">
          {lookup.isFetching ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
          {t('lookup.submit')}
        </Button>
        {mobile !== '' && (
          <Button variant="text" onClick={() => writeMobile('')} data-lookup-clear="">
            {t('lookup.clear')}
          </Button>
        )}
      </form>

      {mobile === '' ? null : lookup.isError ? (
        <div data-lookup-refused="">
          <ErrorBanner className="p-3" message={apiErrorMessage(lookup.error, t('lookup.failed'))} />
        </div>
      ) : !lookup.data ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('lookup.loading')}
        </p>
      ) : lookup.data.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-lookup-empty="">
          {t('lookup.none', { mobile: fsi(mobile) })}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-sm text-muted-foreground">{t('lookup.found', { mobile: fsi(mobile) })}</p>
          <ul className="flex flex-col gap-1" data-lookup-results="">
            {lookup.data.map((g) => (
              <li key={g.groupId} data-lookup-group={g.groupId} data-lookup-active={g.isActive ? 'true' : 'false'}>
                <Link
                  to={`/loy/groups/${encodeURIComponent(g.groupId)}`}
                  className="inline-flex items-center gap-2 rounded-md px-1 py-0.5 text-sm hover:bg-muted"
                >
                  <span className="font-mono font-medium" data-lookup-code="">
                    <Ltr>{g.code}</Ltr>
                  </span>
                  <bdi data-lookup-name="">{loyGroupName(g, i18n.language)}</bdi>
                  {!g.isActive && <StatusBadge sev="mute">{t('status.inactive')}</StatusBadge>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  )
}
