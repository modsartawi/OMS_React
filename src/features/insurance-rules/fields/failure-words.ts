import { apiErrorMessage, isBareDenial } from '@/core/api'

/** A failed read or write in words: a bare 403 says what grant is missing, anything else is HQ's own message. */
export function failureWords(err: unknown, denied: string, fallback: string): string {
  return isBareDenial(err) ? denied : apiErrorMessage(err, fallback)
}
