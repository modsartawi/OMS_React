import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { refusedItems, refusalsOf, runBatch, type BatchResult } from '@/core/util/batch-runner'

/**
 * One dialog session: it begins each time `open` changes (open → a new session, close → the old one
 * ends). `begin()` stamps work as it starts and hands back `isCurrent()`, so work that settles after
 * the dialog was closed (or closed and reopened) never writes into the new session.
 */
export function useDialogSession(open: boolean): () => () => boolean {
  const session = useRef(0)
  useEffect(() => {
    session.current += 1
  }, [open])
  return useCallback(() => {
    const mine = session.current
    return () => session.current === mine
  }, [])
}

export interface BatchProgressState {
  completed: number
  total: number
}

export interface UseBatchRunOptions<T> {
  /** The dialog's `open`: each opening clears the last progress and result. */
  open: boolean
  /** The single-item write. */
  write: (item: T) => Promise<unknown>
  /** After a batch: the refused items, which stay ticked so pressing the button again retries just them. */
  onPicks: (refused: T[]) => void
  /** After a batch that wrote at least one item: re-read what it changed. */
  onDone?: () => void | Promise<void>
}

/**
 * The batch flow every batch picker dialog shares (spec 805): the progress while it runs, the last
 * result and its refusals by item, and `run(items)` — run → refused items back into the picks →
 * re-read when anything was written. An expired session ends the batch and is `handle401`'s (it is
 * already redirecting), so no result is kept. A batch that settles after its dialog session ended
 * keeps nothing in the new one; the re-read still runs, since its writes did happen.
 */
export function useBatchRun<T>({ open, write, onPicks, onDone }: UseBatchRunOptions<T>) {
  const [progress, setProgress] = useState<BatchProgressState | null>(null)
  const [result, setResult] = useState<BatchResult<T> | null>(null)
  const begin = useDialogSession(open)
  // The latest callbacks, so a run started under one render calls the current ones.
  const latest = useRef({ write, onPicks, onDone })
  latest.current = { write, onPicks, onDone }

  useEffect(() => {
    if (open) {
      setProgress(null)
      setResult(null)
    }
  }, [open])

  const running = progress !== null

  const run = useCallback(
    async (items: readonly T[]) => {
      if (items.length === 0) return
      const isCurrent = begin()
      setResult(null)
      setProgress({ completed: 0, total: items.length })
      const outcome = await runBatch(
        items,
        (item) => latest.current.write(item),
        (p) => {
          if (isCurrent()) setProgress({ completed: p.completed, total: p.total })
        },
      )
      if (isCurrent()) setProgress(null)
      // An expired session is handle401's: it is already redirecting to the login.
      if (outcome.stopped) return
      if (isCurrent()) {
        setResult(outcome)
        latest.current.onPicks(refusedItems(outcome))
      }
      if (outcome.done > 0) await latest.current.onDone?.()
    },
    [begin],
  )

  const refusals = useMemo(() => refusalsOf(result), [result])

  return { progress, running, result, refusals, run, begin }
}
