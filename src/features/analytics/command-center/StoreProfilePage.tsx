import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams, useSearchParams } from 'react-router'
import { Download, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { homeHref } from '@/core/command-center-routes'
import type { CcStoreProfile } from '@/core/models/command-center'
import { usePermissions } from '@/core/permissions'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatRange } from '@/core/util/bidi'
import { saveBlob } from '@/core/util/download-file'
import { canOpenCommandCenter, commandCenterNotOffered } from './access'
import LanguageSwitch from './LanguageSwitch'
import { NS, pageDir, useCcLang, type CcT } from './lang'
import PeriodPicker from './PeriodPicker'
import ProfileSection, { type HrefOf } from './ProfileSection'
import { storeRequestOf, storeTargetHref, withPeriod, type StorePeriod, type StoreProfileRequest } from './store-profile'
import { storeExportName, storeProfileApi, storeProfileQuery } from './store-profile-api'

/**
 * A pharmacy's store profile (oms 948, BackOffice spec 4165 "The store profile"; BO 4177): one pharmacy for a period —
 * the rolling 4 weeks with the same weeks last year beside them by default, year-to-date, or dates. Opened from the
 * scorecard panel, a scorecard list or a link (`storeProfileHref`). Behind the home's own gate (the analytics view grant
 * while the server offers the command center), in the home's language (`?lang=`, decisions §3). The sections are the
 * server's, in its order; the page computes no figure.
 */
export default function StoreProfilePage() {
  const { lang, t, setLang } = useCcLang()
  const route = useParams()
  const [params] = useSearchParams()
  const request = storeRequestOf(route, params)
  const keyPrefix = commandCenterNotOffered(usePermissions()) ? 'offer' : 'access'
  return (
    <div dir={pageDir(lang)} lang={lang} className="h-full" data-cc-page>
      <ScreenGate can={canOpenCommandCenter} ns={NS} keyPrefix={keyPrefix} title={t('storeProfile.title')} subtitle={t('storeProfile.subtitle')}>
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

function Profile({ request, t }: { request: StoreProfileRequest; t: CcT }) {
  const profile = useQuery(storeProfileQuery(request))
  const [params, setParams] = useSearchParams()
  const onPeriod = (next: StorePeriod) => setParams(withPeriod(params, next))
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <PeriodPicker key={periodKey(request)} value={request} onChange={onPeriod} t={t} />
        <ExportButton request={request} t={t} />
      </div>
      {profile.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('storeProfile.loading')}
        </p>
      ) : profile.isError ? (
        <ErrorBanner message={apiErrorMessage(profile.error, t('storeProfile.loadFailed'))} />
      ) : (
        <ProfileBody profile={profile.data} request={request} t={t} />
      )}
    </div>
  )
}

/** Downloads the server's workbook for the pharmacy and period the page shows (one sheet per section, BO 4177). */
function ExportButton({ request, t }: { request: StoreProfileRequest; t: CcT }) {
  const [exporting, setExporting] = useState(false)
  async function download() {
    setExporting(true)
    try {
      const file = await storeProfileApi.export(request)
      saveBlob(file.filename || storeExportName(request), file.blob)
    } catch (err) {
      notify.apiError(t('storeProfile.exportFailed'), err, t('storeProfile.exportFailed'))
    } finally {
      setExporting(false)
    }
  }
  return (
    <Button variant="secondary" onClick={download} disabled={exporting} data-cc-export>
      {exporting ? <Loader2 aria-hidden className="size-3.5 animate-spin" /> : <Download aria-hidden className="size-3.5" />}
      {t('storeProfile.export')}
    </Button>
  )
}

/** The picker remounts on a new period, so its typed dates follow the URL. */
const periodKey = (period: StorePeriod): string => (period.period === 'dates' ? `dates:${period.from}:${period.to}` : period.period)

function ProfileBody({ profile, request, t }: { profile: CcStoreProfile; request: StoreProfileRequest; t: CcT }) {
  const { lang } = request
  // A category opens its category profile narrowed to this pharmacy; a pharmacy its store profile; in the page language.
  const hrefOf: HrefOf = storeTargetHref(profile.storeCode, lang)
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
