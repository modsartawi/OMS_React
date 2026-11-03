/* PROTOTYPE 754 — throwaway. Embedded Apache Superset (Apache-2.0, free embedding) inside the
 * real AppShell. The dashboard was created entirely by Superset's REST API
 * (C:\Playground\ss-proto\setup-superset.mjs); the guest token is minted server-side by the Vite
 * `/ssguest` middleware, standing in for SIS.Api. Synthetic SQLite, never the replica.
 * Copy is literal; raw fetch is a prototype exception to api-envelope.
 */
import { useEffect, useRef, useState } from 'react'
import { embedDashboard, type EmbeddedDashboard } from '@superset-ui/embedded-sdk'

const env = import.meta.env

/** DMSCO tokens → Superset 6 (Ant Design) theme tokens, read live so light/dark follow the app. */
function dmscoSupersetTheme() {
  const css = getComputedStyle(document.documentElement)
  const v = (n: string) => css.getPropertyValue(n).trim()
  return {
    token: {
      colorPrimary: v('--primary'),
      colorLink: v('--primary-800'),
      colorBgBase: v('--card'),
      colorBgLayout: v('--background'),
      colorTextBase: v('--foreground'),
      colorBorder: v('--border'),
      colorSuccess: v('--success'),
      colorError: v('--danger'),
      borderRadius: 8,
      fontFamily: "'IBM Plex Sans', 'IBM Plex Sans Arabic', system-ui, sans-serif",
      fontSize: 13,
    },
  }
}

export default function SupersetVariant({ scenario }: { scenario: string }) {
  const mount = useRef<HTMLDivElement>(null)
  const [mask, setMask] = useState<Record<string, unknown> | null>(null)
  const [themed, setThemed] = useState(true)
  const embedded = useRef<EmbeddedDashboard | null>(null)
  const id = scenario === 'ar' ? env.VITE_SS_AR : env.VITE_SS_EN

  useEffect(() => {
    let alive = true
    let handle: EmbeddedDashboard | null = null
    embedDashboard({
      id,
      supersetDomain: env.VITE_SS_URL,
      mountPoint: mount.current!,
      fetchGuestToken: () => fetch(`/ssguest?id=${id}`).then((r) => r.json()).then((j) => j.token),
      dashboardUiConfig: { hideTitle: true, filters: { expanded: false }, emitDataMasks: true, urlParams: { lang: scenario } },
      iframeTitle: 'HQ board (Superset)',
    }).then((d) => {
      if (!alive) return d.unmount()
      handle = d
      embedded.current = d
      d.setThemeConfig(dmscoSupersetTheme())
      d.observeDataMask((m) => setMask(m))
    })
    return () => {
      alive = false
      handle?.unmount()
    }
  }, [id, scenario])

  const toggleTheme = () => {
    const next = !themed
    setThemed(next)
    embedded.current?.setThemeConfig(next ? dmscoSupersetTheme() : { token: {} })
  }

  // what the host app can SEE of the user's clicks inside the iframe — the hook for drill-into-OMS
  const crossFilters = mask
    ? Object.entries(mask)
        .filter(([k]) => k !== 'crossFiltersChanged' && k !== 'nativeFiltersChanged')
        .flatMap(([k, v]) => {
          const f = (v as { extraFormData?: { filters?: { col: string; val: unknown[] }[] } })?.extraFormData?.filters ?? []
          return f.map((x) => `${k}: ${x.col} = ${JSON.stringify(x.val)}`)
        })
    : []

  return (
    <div className="flex h-full min-h-[760px] flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border bg-card px-3 py-2 text-xs">
        <span className="font-semibold">Embedded Apache Superset 6.1 · free (Apache-2.0)</span>
        <span className="text-muted-foreground">created by REST · guest token minted server-side</span>
        <button type="button" className="ms-auto rounded-full border border-border px-3 py-1" onClick={toggleTheme}>
          {themed ? 'DMSCO theme: on' : 'DMSCO theme: off'}
        </button>
      </div>
      <div className="rounded-lg border border-dashed border-border bg-card-2 px-3 py-1.5 text-xs" data-testid="ss-mask">
        <span className="font-medium">Host sees (observeDataMask): </span>
        {crossFilters.length ? crossFilters.join(' · ') : 'no cross-filter yet — click a bar, slice or row'}
      </div>
      <div ref={mount} className="ss-embed min-h-0 flex-1 overflow-hidden rounded-lg border border-border [&>iframe]:h-full [&>iframe]:w-full [&>iframe]:border-0" />
    </div>
  )
}
