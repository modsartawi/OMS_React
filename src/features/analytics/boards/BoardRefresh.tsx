import { useCallback, useEffect, useRef } from 'react'
import type { SetURLSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import Field from '@/core/ui/Field'
import Select from '@/core/ui/Select'
import { boardRefresh, intervalMs, type RefreshInterval, nextDueAt, refreshChoices, refreshFloorMs, startSchedule, tick } from './refresh-schedule'

/**
 * A board's auto-refresh (spec 766 §F, ticket 780): the picker, the viewer's choice, and the one loop.
 * The schedule itself is pure (`./refresh-schedule`); this file only binds it to the clock, the tab's
 * visibility, the URL and the session.
 */

/** The floor from config, provisional on 750 (`VITE_ANALYTICS_REFRESH_FLOOR_S`; 30 s unless set). */
export const REFRESH_FLOOR_MS = refreshFloorMs(import.meta.env.VITE_ANALYTICS_REFRESH_FLOOR_S)

const sessionKey = (boardId: string) => `oms.analytics.refresh.${boardId}`

function sessionChoice(boardId: string): string | null {
  try {
    return sessionStorage.getItem(sessionKey(boardId))
  } catch {
    return null
  }
}

/**
 * The interval the board runs at — the permalink's `refresh=`, else this session's choice, else the
 * board's saved default — and the picker's setter, which writes the permalink and the session, never the board.
 */
export function useRefreshChoice(boardId: string, saved: number | null | undefined, params: URLSearchParams, setParams: SetURLSearchParams) {
  const choice = boardRefresh({ url: params.get('refresh'), session: sessionChoice(boardId), saved }, REFRESH_FLOOR_MS)
  const setChoice = useCallback(
    (next: RefreshInterval) => {
      try {
        sessionStorage.setItem(sessionKey(boardId), next)
      } catch {
        // No session storage (a private window): the URL still carries the choice.
      }
      setParams(
        (prev) => {
          const out = new URLSearchParams(prev)
          out.set('refresh', next)
          return out
        },
        { replace: true },
      )
    },
    [boardId, setParams],
  )
  return [choice, setChoice] as const
}

/**
 * The board's ONE refresh loop: one timer, armed for the next panel due, re-asking each view panel at its
 * staggered turn. Nothing while the tab is hidden; on return, each panel that missed its turn re-asks once.
 */
export function useRefreshLoop(panelIds: readonly string[], choice: RefreshInterval, refresh: (panelId: string) => void) {
  const ids = panelIds.join('\n')
  const latest = useRef(refresh)
  useEffect(() => {
    latest.current = refresh
  }, [refresh])
  useEffect(() => {
    const every = intervalMs(choice)
    const list = ids ? ids.split('\n') : []
    if (!every || list.length === 0) return
    let schedule = startSchedule(list, every, Date.now())
    let timer: ReturnType<typeof setTimeout> | undefined
    const arm = () => {
      clearTimeout(timer)
      if (!document.hidden) timer = setTimeout(run, Math.max(0, nextDueAt(schedule) - Date.now()))
    }
    const run = () => {
      const step = tick(schedule, Date.now(), document.hidden)
      schedule = step.schedule
      for (const id of step.due) latest.current(id)
      arm()
    }
    const onVisibility = () => (document.hidden ? clearTimeout(timer) : run())
    document.addEventListener('visibilitychange', onVisibility)
    arm()
    return () => {
      clearTimeout(timer)
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [ids, choice])
}

/** Off, 30 s, 1 min, 5 min, 15 min — those at or above the floor. */
export function RefreshPicker({ value, onChange }: { value: RefreshInterval; onChange: (next: RefreshInterval) => void }) {
  const { t } = useTranslation('boards')
  return (
    <Field label={t('board.refresh.label')} className="w-44">
      <Select value={value} onChange={(e) => onChange(e.target.value as RefreshInterval)} data-board-refresh={value}>
        {refreshChoices(REFRESH_FLOOR_MS).map((c) => (
          <option key={c} value={c}>
            {t(`board.refresh.${c}`)}
          </option>
        ))}
      </Select>
    </Field>
  )
}
