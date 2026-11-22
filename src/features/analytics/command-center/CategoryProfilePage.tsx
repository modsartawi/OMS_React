import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { Download, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { categoryProfileHref, homeHref, targetHref } from '@/core/command-center-routes'
import type { CcCategoryProfile, CcScope } from '@/core/models/command-center'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange } from '@/core/util/bidi'
import { saveBlob } from '@/core/util/download-file'
import { canOpenCommandCenter, commandCenterNotOffered } from './access'
import { categoryRequestOf, withScope, type CategoryProfileRequest } from './category-profile'
import { categoryExportName, categoryProfileApi, categoryProfileQuery } from './category-profile-api'
import LanguageSwitch from './LanguageSwitch'
import { NS, pageDir, useCcLang, type CcT } from './lang'
import ProfileSection, { type HrefOf } from './ProfileSection'
import ScopeFilter from './ScopeFilter'

/**
 * A category profile (oms 949, BackOffice spec 4165 "The category profile"; BO 4178): one category at the top or the
 * second level, for the chain, a region or one pharmacy. Opened from a category name in the brief, from a store
 * profile's category mix, or from a top-level profile's list of its second-level categories (the same page one level
 * down). Behind the home's own gate (the analytics view grant while the server offers the command center), in the
 * home's language (`?lang=`, decisions §3). The sections are the server's, in its order; the page computes no figure.
 */
export default function CategoryProfilePage() {
  const { lang, t, setLang } = useCcLang()
  const route = useParams()
  const [params] = useSearchParams()
  const request = categoryRequestOf(route, params)
  const keyPrefix = commandCenterNotOffered(usePermissions()) ? 'offer' : 'access'
  return (
    <div dir={pageDir(lang)} lang={lang} className="h-full" data-cc-page>
      <ScreenGate
        can={canOpenCommandCenter}
        ns={NS}
        keyPrefix={keyPrefix}
        title={t('categoryProfile.title')}
        subtitle={t('categoryProfile.subtitle')}
      >
        <div className="flex flex-col gap-4">
          <div className="flex justify-end">
            <LanguageSwitch lang={lang} onChange={setLang} t={t} />
          </div>
          <Profile request={request} t={t} />
        </div>
      </ScreenGate>
    </div>
  )
}

function Profile({ request, t }: { request: CategoryProfileRequest; t: CcT }) {
  const profile = useQuery(categoryProfileQuery(request))
  if (profile.isPending)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {t('categoryProfile.loading')}
      </p>
    )
  if (profile.isError) return <ErrorBanner message={apiErrorMessage(profile.error, t('categoryProfile.loadFailed'))} />
  return <ProfileBody profile={profile.data} request={request} t={t} />
}

/** Downloads the server's workbook for the request the page shows (one sheet per section, BO 4178). */
function ExportButton({ request, t }: { request: CategoryProfileRequest; t: CcT }) {
  const [exporting, setExporting] = useState(false)
  async function download() {
    setExporting(true)
    try {
      const file = await categoryProfileApi.export(request)
      saveBlob(file.filename || categoryExportName(request), file.blob)
    } catch (err) {
      notify.apiError(t('categoryProfile.exportFailed'), err, t('categoryProfile.exportFailed'))
    } finally {
      setExporting(false)
    }
  }
  return (
    <Button variant="secondary" onClick={download} disabled={exporting} data-cc-export>
      {exporting ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Download aria-hidden className="size-3.5" />}
      {t('categoryProfile.export')}
    </Button>
  )
}

/** The filter remounts on a new narrowing, so its typed pharmacy code follows the URL. */
const scopeKey = (scope: CcScope): string =>
  scope.kind === 'region' ? `region:${scope.region}` : scope.kind === 'store' ? `store:${scope.storeCode}` : 'chain'

function ProfileBody({ profile, request, t }: { profile: CcCategoryProfile; request: CategoryProfileRequest; t: CcT }) {
  const { lang, scope } = request
  const [params, setParams] = useSearchParams()
  const onScope = (next: CcScope) => setParams(withScope(params, next))
  // On a profile a pharmacy opens its store profile (948); a category opens its own profile, in the page language.
  const hrefOf: HrefOf = (target) => targetHref(target, { lang, store: 'profile' })
  return (
    <div className="flex flex-col gap-4" data-cc-category-level={profile.level}>
      <header className="flex flex-col gap-1">
        <nav className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground" aria-label={t('categoryProfile.trail')}>
          <Link to={homeHref({ lang })} className="text-primary underline-offset-2 hover:underline">
            {t('title')}
          </Link>
          {profile.parent && (
            <Link
              to={categoryProfileHref({ level: 'top', code: profile.parent.code, scope, lang })}
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
        <ScopeFilter key={scopeKey(scope)} scope={scope} regions={profile.regions} onChange={onScope} t={t} />
        <ExportButton request={request} t={t} />
      </div>
      {profile.children && profile.children.length > 0 && (
        <section className="rounded-lg border border-border/60 bg-card p-4" data-cc-children>
          <h3 className="mb-2 text-sm font-semibold tracking-tight">{t('categoryProfile.children')}</h3>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
            {profile.children.map((child) => (
              <li key={child.code}>
                <Link
                  to={categoryProfileHref({ level: 'second', code: child.code, scope, lang })}
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
