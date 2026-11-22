import { useQuery } from '@tanstack/react-query'
import { useSearchParams } from 'react-router'
import AskButton from '@/core/findings/AskButton'
import type { CcLang } from '@/core/models/command-center'
import { fsi } from '@/core/util/bidi'
import { homeQuery } from './api'
import Brief from './Brief'
import { filterOf, withFilter, withStore } from './home-url'
import KingdomMap from './KingdomMap'
import PageFrame from './PageFrame'
import QueryState from './QueryState'
import ScorecardPanel from './ScorecardPanel'
import StatusLine from './StatusLine'
import type { CcT } from './lang'

/**
 * The Retail Command Center home (oms 946, BackOffice spec 4165 "The home page"): the morning brief on the start side,
 * the kingdom map and the region table on the end side (947, with the scorecard panel a pharmacy opens). In the
 * command center's frame (`./PageFrame`): absent while the server does not offer it, behind the analytics view grant,
 * in English or Arabic (`?lang=`, decisions §3) with the switch beside the status line. The server is asked for the
 * brief in the page language. The page computes no figure, colour or order.
 */
export default function CommandCenterPage() {
  return (
    <PageFrame titleKey="title" subtitleKey="subtitle" lead={({ lang, t }) => <HomeStatus lang={lang} t={t} />}>
      {({ lang, t }) => <Home lang={lang} t={t} />}
    </PageFrame>
  )
}

/** The status line under the title, once the home has answered (the same query the body reads: one request). */
function HomeStatus({ lang, t }: { lang: CcLang; t: CcT }) {
  const home = useQuery(homeQuery(lang))
  return home.data ? <StatusLine dataAsOf={home.data.dataAsOf} runs={home.data.runs} t={t} /> : null
}

function Home({ lang, t }: { lang: CcLang; t: CcT }) {
  const home = useQuery(homeQuery(lang))
  // 947: the map filter and the open scorecard live in the URL, so a brief link opens the same panel a map point does.
  const [params, setParams] = useSearchParams()
  const filter = filterOf(params)
  const store = params.get('store')
  return (
    <>
      <QueryState query={home} loading={t('loading')} failed={t('loadFailed')}>
        {(data) => (
          <>
            {!data.isLatest && (
              <p className="text-sm text-muted-foreground" data-cc-previous-night>
                {t('previousNight', { night: fsi(data.night) })}
              </p>
            )}
            <div className="grid gap-4 lg:grid-cols-2">
              <Brief brief={data.brief} lang={lang} filter={filter} t={t} />
              <KingdomMap
                home={data}
                filter={filter}
                onFilter={(next) => setParams(withFilter(params, next), { replace: true })}
                onStore={(code) => setParams(withStore(params, code))}
                lang={lang}
                t={t}
              />
            </div>
          </>
        )}
      </QueryState>
      {store && (
        <ScorecardPanel
          storeCode={store}
          lang={lang}
          t={t}
          onClose={() => setParams(withStore(params, null))}
          // 950's Ask for the pharmacy: present only while the server sends `ask` and the reader holds the copilot.
          action={(card) => <AskButton ask={card.ask} lang={lang} label={t('ask.store')} hint={t('ask.storeHint')} />}
        />
      )}
    </>
  )
}
