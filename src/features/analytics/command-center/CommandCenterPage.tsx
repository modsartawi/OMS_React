import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import { apiErrorMessage } from '@/core/api'
import type { CcLang } from '@/core/models/command-center'
import { usePermissions } from '@/core/permissions'
import ErrorBanner from '@/core/ui/ErrorBanner'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { canOpenCommandCenter, commandCenterNotOffered } from './access'
import { homeQuery } from './api'
import Brief from './Brief'
import { filterOf, withFilter, withStore } from './home-url'
import KingdomMap from './KingdomMap'
import LanguageSwitch from './LanguageSwitch'
import ScorecardPanel from './ScorecardPanel'
import StatusLine from './StatusLine'
import { NS, pageDir, useCcLang, type CcT } from './lang'

/**
 * The Retail Command Center home (oms 946, BackOffice spec 4165 "The home page"): the morning brief on the start side,
 * the kingdom map and the region table on the end side (947, with the scorecard panel a pharmacy opens). Behind the analytics view grant while the
 * server offers it (`canOpenCommandCenter`, the menu leaf's own predicate), failing closed: with the switch off nothing
 * is asked of the server and the page says the command center is not switched on.
 *
 * The page is in English or Arabic (`?lang=`, decisions §3): its root carries `dir`, its words come from a translator
 * fixed to the language, and the server is asked for the brief in it. The page computes no figure, colour or order.
 */
export default function CommandCenterPage() {
  const { lang, t, setLang } = useCcLang()
  // One gate, two sentences: without the grant the denial (`access.*`); with it but the switch off, "not switched on".
  const keyPrefix = commandCenterNotOffered(usePermissions()) ? 'offer' : 'access'
  return (
    <div dir={pageDir(lang)} lang={lang} className="h-full" data-cc-page>
      <ScreenGate can={canOpenCommandCenter} ns={NS} keyPrefix={keyPrefix} title={t('title')} subtitle={t('subtitle')}>
        <Home lang={lang} t={t} setLang={setLang} />
      </ScreenGate>
    </div>
  )
}

function Home({ lang, t, setLang }: { lang: CcLang; t: CcT; setLang: (lang: CcLang) => void }) {
  const home = useQuery(homeQuery(lang))
  // 947: the map filter and the open scorecard live in the URL, so a brief link opens the same panel a map point does.
  const [params, setParams] = useSearchParams()
  const filter = filterOf(params)
  const store = params.get('store')
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">{home.data && <StatusLine dataAsOf={home.data.dataAsOf} runs={home.data.runs} t={t} />}</div>
        <LanguageSwitch lang={lang} onChange={setLang} t={t} />
      </div>
      {home.isPending ? (
        <p className="text-sm text-muted-foreground" role="status">
          {t('loading')}
        </p>
      ) : home.isError ? (
        <ErrorBanner message={apiErrorMessage(home.error, t('loadFailed'))} />
      ) : (
        <>
          {!home.data.isLatest && (
            <p className="text-sm text-muted-foreground" data-cc-previous-night>
              {t('previousNight', { night: fsi(home.data.night) })}
            </p>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <Brief brief={home.data.brief} lang={lang} t={t} />
            <KingdomMap
              home={home.data}
              filter={filter}
              onFilter={(next) => setParams(withFilter(params, next), { replace: true })}
              onPharmacy={(code) => setParams(withStore(params, code))}
              lang={lang}
              t={t}
            />
          </div>
        </>
      )}
      {store && <ScorecardPanel storeCode={store} lang={lang} t={t} onClose={() => setParams(withStore(params, null))} />}
    </div>
  )
}
