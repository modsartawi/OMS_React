import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { categoryProfileHref, homeHref, pickPeriod, targetHref, withPeriod, withScope } from '@/core/command-center-routes'
import type { HrefOf } from '@/core/findings/finding-card'
import type { CcCategoryProfile, CcScope } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import { categoryRequestOf, type CategoryProfileRequest } from './category-profile'
import { categoryExportName, categoryProfileApi, categoryProfileQuery } from './category-profile-api'
import ExportButton from './ExportButton'
import type { CcT } from './lang'
import PageFrame from './PageFrame'
import PeriodPicker from './PeriodPicker'
import { periodKey } from './period-picker'
import ProfileSection from './ProfileSection'
import QueryState from './QueryState'
import ScopeFilter from './ScopeFilter'

/**
 * A category profile (oms 949, BackOffice spec 4165 "The category profile"; BO 4178 "a filter … and a period"): one
 * category at the top or the second level, for the chain, a region or one pharmacy, over a period. Opened from a
 * category name in the brief, from a store profile's category mix, or from a top-level profile's list of its
 * second-level categories (the same page one level down). In the command center's frame (`./PageFrame`), in the home's
 * language (`?lang=`, decisions §3). The sections are the server's, in its order; the page computes no figure.
 */
export default function CategoryProfilePage() {
  return (
    <PageFrame titleKey="categoryProfile.title" subtitleKey="categoryProfile.subtitle">
      {({ t }) => <Profile t={t} />}
    </PageFrame>
  )
}

/** The filter remounts on a new narrowing, so its typed pharmacy code follows the URL. */
const scopeKey = (scope: CcScope): string =>
  scope.kind === 'region' ? `region:${scope.region}` : scope.kind === 'store' ? `store:${scope.storeCode}` : 'chain'

function Profile({ t }: { t: CcT }) {
  const route = useParams()
  const [params, setParams] = useSearchParams()
  const request = categoryRequestOf(route, params)
  const profile = useQuery(categoryProfileQuery(request))
  const period = pickPeriod(request)
  // No period named is the server's default, the last four weeks: the picker shows it as the rolling 4 weeks.
  const shown = period.period ? period : ({ period: 'rolling4' } as const)
  return (
    <div className="flex flex-col gap-4">
      <QueryState query={profile} loading={t('categoryProfile.loading')} failed={t('categoryProfile.loadFailed')}>
        {(data) => (
          <ProfileBody profile={data} request={request} t={t}>
            <div className="flex flex-wrap items-end gap-2">
              <ScopeFilter key={scopeKey(request.scope)} scope={request.scope} regions={data.regions} onChange={(next) => setParams(withScope(params, next))} t={t} />
              <PeriodPicker key={periodKey(shown)} value={shown} onChange={(next) => setParams(withPeriod(params, next))} t={t} />
            </div>
          </ProfileBody>
        )}
      </QueryState>
    </div>
  )
}

function ProfileBody({ profile, request, t, children }: { profile: CcCategoryProfile; request: CategoryProfileRequest; t: CcT; children: ReactNode }) {
  const { lang, scope } = request
  const period = pickPeriod(request)
  // On a profile a pharmacy opens its store profile (948); a category opens its own profile, narrowed as the server
  // says or else as this page is; both over the period shown, in the page language.
  const hrefOf: HrefOf = (target) => targetHref(target, { lang, store: 'profile', period, scope })
  return (
    <div className="flex flex-col gap-4" data-cc-category-level={profile.level}>
      <header className="flex flex-col gap-1">
        <nav className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" aria-label={t('categoryProfile.trail')}>
          <Link to={homeHref({ lang })} className="text-primary underline-offset-2 hover:underline">
            {t('title')}
          </Link>
          {profile.parent && (
            <Link
              to={categoryProfileHref({ level: 'top', code: profile.parent.code, scope, ...period, lang })}
              className="text-primary underline-offset-2 hover:underline"
              data-cc-parent
            >
              <bdi>{profile.parent.name}</bdi>
            </Link>
          )}
        </nav>
        <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-semibold tracking-tight">
          <bdi>{profile.category.name}</bdi>
          {profile.unclassified && (
            <span className="text-xs font-medium text-muted-foreground" data-cc-unclassified>
              {t('categoryProfile.unclassified')}
            </span>
          )}
        </h2>
        <p className="flex flex-wrap gap-x-2 text-xs text-muted-foreground">
          <bdi data-cc-scope-label>{profile.scope.label}</bdi>
          <span>
            <bdi>{profile.period.label}</bdi> <Ltr>{formatRange(profile.period.from, profile.period.to)}</Ltr>
          </span>
        </p>
      </header>
      <div className="flex flex-wrap items-end justify-between gap-2">
        {children}
        <ExportButton
          download={() => categoryProfileApi.export(request)}
          fallbackName={categoryExportName(request)}
          label={t('categoryProfile.export')}
          failed={t('categoryProfile.exportFailed')}
        />
      </div>
      {profile.children && profile.children.length > 0 && (
        <section className="rounded-lg border border-border/60 bg-card p-4" data-cc-children>
          <h3 className="mb-2 text-sm font-semibold tracking-tight">{t('categoryProfile.children')}</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.children.map((child) => (
              <li key={child.code}>
                <Link
                  to={categoryProfileHref({ level: 'second', code: child.code, scope, ...period, lang })}
                  className="font-medium text-primary underline-offset-2 hover:underline"
                >
                  <bdi>{child.name}</bdi>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
      <div className="grid gap-4 lg:grid-cols-2">
        {profile.sections.map((section) => (
          <ProfileSection key={section.key} section={section} hrefOf={hrefOf} t={t} />
        ))}
      </div>
    </div>
  )
}
