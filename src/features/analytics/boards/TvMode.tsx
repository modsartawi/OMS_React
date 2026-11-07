import { useCallback, useEffect, useRef, useSyncExternalStore, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SetURLSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Maximize2, Minimize2, Tv } from 'lucide-react'
import type { AnalyticsModel, Param } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, formatRange, fsi } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { analyticsApi, analyticsMembersKey } from './api'
import { boardPeriodOf, paramLabel, stripControlOf, valueOf, type ParamValues } from './params'
import { periodNameKey } from './periods'
import { dimensionOf, measureOf } from './wire'

/**
 * A board's TV mode (spec 766 §F, ticket 780): `tv=1` in the permalink. The shell hides itself on the
 * board route's `chromeless: 'tv'` flag (`layout/shell-route`); here the board fills the viewport, shows
 * its filters as read-only chips, and leaves on Esc. Entering by the button also asks the browser for full
 * screen (a user gesture); a permalink that opens straight into TV mode fills the window, and leaving the
 * browser's full screen leaves TV mode too.
 */
export function useTvMode(params: URLSearchParams, setParams: SetURLSearchParams) {
  const on = params.get('tv') === '1'
  const fullscreen = usePageFullscreen()
  const write = useCallback(
    (tv: boolean) =>
      setParams((prev) => {
        const out = new URLSearchParams(prev)
        if (tv) out.set('tv', '1')
        else out.delete('tv')
        return out
      }),
    [setParams],
  )
  // The whole page goes full screen, not the board's element: `tv=1` swaps the shell for the bare layout,
  // which remounts the board, and an element in full screen that leaves the page drops the browser out of it.
  const enter = useCallback(() => {
    write(true)
    void document.documentElement.requestFullscreen?.().catch(() => {})
  }, [write])
  const exit = useCallback(() => {
    write(false)
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {})
  }, [write])

  useEffect(() => {
    if (!on) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !e.defaultPrevented) exit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [on, exit])

  // The browser's own Esc (or its exit control) ends full screen without a keydown: end TV mode with it.
  const was = useRef(false)
  useEffect(() => {
    if (was.current && !fullscreen.on && on) exit()
    was.current = fullscreen.on
  }, [fullscreen.on, on, exit])

  // A permalink opened straight into TV mode (or reloaded) cannot take full screen without a click: offer one.
  const goFullscreen = useCallback(() => void document.documentElement.requestFullscreen?.().catch(() => {}), [])

  return { on, enter, exit, fullscreen: fullscreen.on, goFullscreen }
}

const onFullscreenChange = (cb: () => void) => {
  document.addEventListener('fullscreenchange', cb)
  return () => document.removeEventListener('fullscreenchange', cb)
}

/** Whether the browser is in full screen at all (TV mode's is the page's, so it outlives the board's remount). */
function usePageFullscreen(): { on: boolean } {
  return { on: useSyncExternalStore(onFullscreenChange, () => !!document.fullscreenElement, () => false) }
}

export function TvButton(p: { on: boolean; fullscreen: boolean; onEnter: () => void; onExit: () => void; onFullscreen: () => void }) {
  const { on, onEnter, onExit } = p
  const { t } = useTranslation('boards')
  return on ? (
    <>
      {!p.fullscreen && (
        <Button variant="secondary" onClick={p.onFullscreen} title={t('board.tv.fullscreenHint')} data-board-tv-fullscreen>
          <Maximize2 className="size-3.5" aria-hidden />
          {t('board.tv.fullscreen')}
        </Button>
      )}
      <Button variant="secondary" onClick={onExit} title={t('board.tv.exitHint')} data-board-tv-exit>
        <Minimize2 className="size-3.5" aria-hidden />
        {t('board.tv.exit')}
      </Button>
    </>
  ) : (
    <Button variant="secondary" onClick={onEnter} data-board-tv-enter>
      <Tv className="size-3.5" aria-hidden />
      {t('board.tv.enter')}
    </Button>
  )
}

/** The board's parameters in TV mode: read-only chips, one per parameter that holds a value (821: from `params`). */
export function FilterChips({ params, values, model, lang }: { params: readonly Param[]; values: ParamValues; model: AnalyticsModel; lang: string }) {
  const { t } = useTranslation('boards')
  return (
    <ul className="flex flex-wrap items-center gap-2 text-sm" aria-label={t('board.tv.chips')} data-board-filter-chips>
      {params.map((param) => {
        const control = stripControlOf(param, model)
        const value = valueOf(param, values)
        const name = paramLabel(param, lang, t)
        if (control.kind === 'period') {
          const period = boardPeriodOf(value)
          if (!period) return null
          return (
            <Chip key={param.name} name={name} filter={param.name}>
              {period.kind === 'fixed' ? <Ltr>{formatRange(period.from, period.to)}</Ltr> : <span>{t(periodNameKey(period.token))}</span>}
            </Chip>
          )
        }
        // 823: the other kinds read as their words; a threshold left off says nothing.
        if (value.kind === 'grain') return <Chip key={param.name} name={name} filter={param.name}><span>{t(`board.params.grain.${value.grain}`)}</span></Chip>
        if (value.kind === 'topN') return <Chip key={param.name} name={name} filter={param.name}><Ltr>{value.n}</Ltr></Chip>
        if (value.kind === 'measure' || value.kind === 'breakdown') {
          const said = saysIn((value.kind === 'measure' ? measureOf(model, value.key) : dimensionOf(model, value.key))?.label, lang)
          return <Chip key={param.name} name={name} filter={param.name}><bdi>{said || value.key}</bdi></Chip>
        }
        if (value.kind === 'threshold') {
          if (value.op === 'off') return null
          const measure = saysIn(measureOf(model, param.measure)?.label, lang) || (param.measure ?? '')
          return (
            <Chip key={param.name} name={name} filter={param.name}>
              <span>{t(`board.params.op.${value.op}`, { measure: fsi(measure) })}</span>
              <Ltr>{measureOf(model, param.measure)?.unit === 'share' ? `${value.value}${t('board.params.percent')}` : value.value}</Ltr>
            </Chip>
          )
        }
        if (value.kind !== 'members' || value.values.length === 0) return null
        if (control.kind !== 'searched' && control.kind !== 'inline' && control.kind !== 'pinned') return null
        if (control.kind === 'searched') return <SearchedChip key={param.name} filter={param.name} name={name} dimension={control.dimension} values={value.values} lang={lang} />
        return (
          <Chip key={param.name} name={name} filter={param.name}>
            {value.values.map((v) => (
              <bdi key={v}>{saysIn(control.values.find((m) => m.key === v)?.label, lang) || v}</bdi>
            ))}
          </Chip>
        )
      })}
    </ul>
  )
}

/** A searched parameter (city, region, store …): labelled from the strip's cached member list (`DimensionValues`, unsearched). */
function SearchedChip({ filter, name, dimension, values, lang }: { filter: string; name: string; dimension: string; values: string[]; lang: string }) {
  const members = useQuery({ queryKey: analyticsMembersKey(dimension, ''), queryFn: () => analyticsApi.dimensionValues(dimension, ''), staleTime: 5 * 60_000, retry: false })
  const nameOf = (v: string) => saysIn(members.data?.find((m) => m.key === v)?.label, lang)
  return (
    <Chip name={name} filter={filter}>
      {values.map((v) => {
        const said = nameOf(v)
        if (dimension === 'store') return <Ltr key={v}>{said ? formatPair(v, said) : v}</Ltr>
        return <bdi key={v}>{said || v}</bdi>
      })}
    </Chip>
  )
}

function Chip({ name, filter, children }: { name: string; filter: string; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1.5 rounded-full border border-border/60 bg-card px-2.5 py-0.5" data-board-filter-chip={filter}>
      <span className="text-muted-foreground">{name}</span>
      <span className="flex flex-wrap gap-1.5 font-medium">{children}</span>
    </li>
  )
}
