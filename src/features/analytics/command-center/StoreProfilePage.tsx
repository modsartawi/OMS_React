import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { homeHref, pickPeriod, targetHref, withPeriod } from '@/core/command-center-routes'
import type { HrefOf } from '@/core/findings/finding-card'
import type { CcStoreProfile } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import ExportButton from './ExportButton'
import type { CcT } from './lang'
import PageFrame from './PageFrame'
import PeriodPicker from './PeriodPicker'
import { periodKey } from './period-picker'
import ProfileSection from './ProfileSection'
import QueryState from './QueryState'
import { storeRequestOf, type StoreProfileRequest } from './store-profile'
import { storeExportName, storeProfileApi, storeProfileQuery } from './store-profile-api'

/**
 * A pharmacy's store profile (oms 948, BackOffice spec 4165 "The store profile"; BO 4177): one pharmacy for a period —
 * the rolling 4 weeks with the same weeks last year beside them by default, year-to-date, or dates. Opened from the
 * scorecard panel, a scorecard list or a link (`storeProfileHref`). In the command center's frame (`./PageFrame`), in
 * the home's language (`?lang=`, decisions §3). The sections are the server's, in its order; the page computes no figure.
 */
export default function StoreProfilePage() {
  return (
    <PageFrame titleKey="storeProfile.title" subtitleKey="storeProfile.subtitle">
      {({ t }) => <Profile t={t} />}
    </PageFrame>
  )
}

function Profile({ t }: { t: CcT }) {
  const route = useParams()
  const [params, setParams] = useSearchParams()
  const request = storeRequestOf(route, params)
  const profile = useQuery(storeProfileQuery(request))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PeriodPicker key={periodKey(request)} value={request} onChange={(next) => setParams(withPeriod(params, next))} t={t} />
        <ExportButton
          download={() => storeProfileApi.export(request)}
          fallbackName={storeExportName(request)}
          label={t('storeProfile.export')}
          failed={t('storeProfile.exportFailed')}
        />
      </div>
      <QueryState query={profile} loading={t('storeProfile.loading')} failed={t('storeProfile.loadFailed')}>
        {(data) => <ProfileBody profile={data} request={request} t={t} />}
      </QueryState>
    </div>
  )
}

function ProfileBody({ profile, request, t }: { profile: CcStoreProfile; request: StoreProfileRequest; t: CcT }) {
  const { lang } = request
  // A category opens its category profile narrowed to this pharmacy (unless the server names another narrowing); a
  // pharmacy its store profile; both over the period shown, in the page language.
  const hrefOf: HrefOf = (target) =>
    targetHref(target, { lang, store: 'profile', period: pickPeriod(request), scope: { kind: 'store', storeCode: profile.storeCode } })
  const { period } = profile
  return (
    <div className="flex flex-col gap-4" data-cc-store={profile.storeCode}>
      <header className="flex flex-col gap-1">
        <nav className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" aria-label={t('storeProfile.trail')}>
          <Link to={homeHref({ lang })} className="text-primary underline-offset-2 hover:underline">
            {t('title')}
          </Link>
        </nav>
        <h2 className="text-lg font-semibold tracking-tight">
          <Ltr>{profile.title}</Ltr>
        </h2>
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground" data-cc-period-shown={period.kind}>
          <bdi>{period.label}</bdi>
          <Ltr>{formatRange(period.from, period.to)}</Ltr>
          <span>{t('storeProfile.beside')}</span>
          <Ltr>{formatRange(period.compareFrom, period.compareTo)}</Ltr>
        </p>
      </header>
      <div className="grid gap-4 lg:grid-cols-2">
        {profile.sections.map((section) => (
          <ProfileSection key={section.key} section={section} hrefOf={hrefOf} t={t} />
        ))}
      </div>
    </div>
  )
}
