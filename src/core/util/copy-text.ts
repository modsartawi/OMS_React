/**
 * Put text on the clipboard, on plain http too (spec 470, ticket 471).
 *
 * ⚠ **`navigator.clipboard` exists only in a secure context.** This app is served over
 * plain http from IIS on the internal network, where the API is simply absent, so a bare
 * `navigator.clipboard.writeText` copies nothing there. The fallback is the old way: a
 * hidden textarea, selected, and `document.execCommand('copy')`.
 *
 * ⚠ **A modal `<dialog>` makes everything outside it unselectable.** A caller inside a
 * `showModal()` dialog passes that dialog as `container`, so the textarea is selectable.
 *
 * It resolves `'copied'` or `'failed'` and never throws: each caller words the outcome its
 * own way. It never logs the text: a receipt's JSON carries customer data.
 */

export type CopyOutcome = 'copied' | 'failed'

/** What the helper reads off the browser; injected by the tests (vitest runs under node). */
export interface CopyEnv {
  clipboard: { writeText: (text: string) => Promise<void> } | undefined
  secure: boolean
  /** The textarea + `execCommand('copy')` fallback; true when the browser says it copied. */
  execCopy: (text: string, container: HTMLElement | undefined) => boolean
}

export function copyText(
  text: string,
  { container }: { container?: HTMLElement | null } = {},
  env: CopyEnv = browserEnv(),
): Promise<CopyOutcome> {
  const fallback = (): CopyOutcome => {
    try {
      return env.execCopy(text, container ?? undefined) ? 'copied' : 'failed'
    } catch {
      return 'failed'
    }
  }
  let write: Promise<void> | undefined
  try {
    write = env.secure && env.clipboard ? Promise.resolve(env.clipboard.writeText(text)) : undefined
  } catch {
    write = undefined
  }
  // No API: the fallback runs now, inside the click's user activation, not after an await.
  if (!write) return Promise.resolve(fallback())
  return write.then(
    () => 'copied' as const,
    () => fallback(),
  )
}

function browserEnv(): CopyEnv {
  const nav = typeof navigator === 'undefined' ? undefined : navigator
  return {
    clipboard: nav?.clipboard,
    secure: typeof window !== 'undefined' && window.isSecureContext === true,
    execCopy,
  }
}

function execCopy(text: string, container: HTMLElement | undefined): boolean {
  if (typeof document === 'undefined') return false
  const host = container ?? document.body
  const focused = document.activeElement instanceof HTMLElement ? document.activeElement : null
  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.setAttribute('aria-hidden', 'true')
  // Off-screen but selectable: `display: none` or `visibility: hidden` could not be selected.
  area.style.position = 'fixed'
  area.style.top = '0'
  area.style.insetInlineStart = '0'
  area.style.opacity = '0'
  area.style.pointerEvents = 'none'
  host.appendChild(area)
  try {
    area.focus()
    area.select()
    area.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } finally {
    area.remove()
    focused?.focus()
  }
}
