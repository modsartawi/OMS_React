// Latest-wins by a request sequence, not by arrival (oms 678; graduated from the playground for oms 695, the Fields
// page's Compile). Pure: no React, no http — the page hands it the door call. A slow older reply never overwrites a
// newer one.

export type RunSettle<R> = { ok: true; value: R } | { ok: false; error: unknown }

export interface LatestWins<B> {
  /** An edit: restarts the window. `null` (JSON that does not parse) sends nothing and drops the waiting body. */
  edit(body: B | null): void
  /** Sends nothing more and tells nothing more (the page unmounted). */
  dispose(): void
}

export function latestWins<B, R>(opts: {
  delayMs: number
  run: (body: B) => Promise<R>
  /** A request was sent (the outcome shows "running…"). */
  onStart?: () => void
  /** The NEWEST request answered; an older request's answer is never told. */
  onSettle: (s: RunSettle<R>) => void
}): LatestWins<B> {
  let seq = 0
  let timer: ReturnType<typeof setTimeout> | null = null
  let disposed = false
  const clear = () => {
    if (timer !== null) clearTimeout(timer)
    timer = null
  }
  const fire = (body: B) => {
    timer = null
    const mine = ++seq
    opts.onStart?.()
    opts.run(body).then(
      (value) => {
        if (!disposed && mine === seq) opts.onSettle({ ok: true, value })
      },
      (error: unknown) => {
        if (!disposed && mine === seq) opts.onSettle({ ok: false, error })
      },
    )
  }
  return {
    edit(body) {
      if (disposed) return
      clear()
      if (body !== null) timer = setTimeout(() => fire(body), opts.delayMs)
    },
    dispose() {
      disposed = true
      clear()
    },
  }
}
