import { useCallback, useEffect, useRef, type ReactNode, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { SetURLSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Minimize2, Tv } from 'lucide-react'
import type { AnalyticsModel, Param } from '@/core/models/analytics'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { formatPair, formatRange } from '@/core/util/bidi'
import { saysIn } from '@/core/rules/sentence'
import { analyticsApi, analyticsMembersKey } from './api'
import { useFullscreen } from './panel-hooks'
import { boardPeriodOf, paramLabel, stripControlOf, valueOf, type ParamValues } from './params'
import { periodNameKey } from './periods'

/**
 * A board's TV mode (spec 766 §F, ticket 780): `tv=1` in the permalink. The shell hides itself on the
 * board route's `chromeless: 'tv'` flag (`layout/shell-route`); here the board fills the viewport, shows
 * its filters as read-only chips, and leaves on Esc. Entering by the button also asks the browser for full
 * screen (a user gesture); a permalink that opens straight into TV mode fills the window, and leaving the
 * browser's full screen leaves TV mode too.
 */
export function useTvMode(ref: RefObject<HTMLElement | null>, params: URLSearchParams, setParams: SetURLSearchParams) {
  const on = params.get('tv') === '1'
  const fullscreen = useFullscreen(ref)
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
  const enter = useCallback(() => {
    write(true)
    void ref.current?.requestFullscreen?.().catch(() => {})
  }, [write, ref])
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

  return { on, enter, exit }
}

export function TvButton({ on, onEnter, onExit }: { on: boolean; onEnter: () => void; onExit: () => void }) {
  const { t } = useTranslation('boards')
  return on ? (
    <Button variant="secondary" onClick={onExit} title={t('board.tv.exitHint')} data-board-tv-exit>
      <Minimize2 className="size-3.5" aria-hidden />
      {t('board.tv.exit')}
    </Button>
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
        if (control.kind === 'none' || value.kind !== 'members' || value.values.length === 0) return null
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
