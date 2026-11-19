/**
 * The phone's sign-in: the Ua `mobile` session's bearer token, kept on the device so the installed app reopens signed
 * in for the life of the session (the server decides that life, and a 401 ends it here). The channel key (`x-api-key`)
 * is the build's, as the collector app's is: it names the channel, never the person.
 *
 * Device storage can be missing or throw (a private window, cleared site data), so every read and write is guarded;
 * without it the app simply asks for a sign-in again.
 */

const STORAGE_KEY = 'minipos.session'

export interface PhoneSession {
  token: string
  userId: string
  displayName: string | null
  expiresAt: string | null
}

/** The mobile channel's key, set at build time (`VITE_MINIPOS_API_KEY`). Empty when the build was not given one. */
export const MINIPOS_API_KEY: string = import.meta.env.VITE_MINIPOS_API_KEY ?? ''

let current: PhoneSession | null = read()

function read(): PhoneSession | null {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<PhoneSession>
    return typeof parsed.token === 'string' && parsed.token && typeof parsed.userId === 'string'
      ? { token: parsed.token, userId: parsed.userId, displayName: parsed.displayName ?? null, expiresAt: parsed.expiresAt ?? null }
      : null
  } catch {
    return null
  }
}

export function phoneSession(): PhoneSession | null {
  return current
}

export function savePhoneSession(session: PhoneSession): void {
  current = session
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(session))
  } catch {
    /* kept in memory for this page life */
  }
}

export function clearPhoneSession(): void {
  current = null
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY)
  } catch {
    /* nothing stored */
  }
}

/** The headers every Mini POS call carries: the channel key, and the bearer once signed in. */
export function phoneHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'x-api-key': MINIPOS_API_KEY }
  if (current) headers.Authorization = `Bearer ${current.token}`
  return headers
}
