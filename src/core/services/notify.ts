import { toast } from 'sonner'
import { ApiError, apiErrorMessage } from '@/core/api'

/**
 * The app's toast policy, in one place.
 *
 * Screen 1 calls `toast.*` directly — fine, it has two failure paths. Screen 2
 * has a dozen (load, refresh, six actions, three picker fetches), and the
 * interesting part is not *how* to toast but *which failures deserve what*.
 * That decision lives here so every call site agrees.
 */
export const notify = {
  success(title: string, description?: string): void {
    toast.success(title, { description })
  },
  info(title: string, description?: string): void {
    toast.info(title, { description })
  },
  warn(title: string, description?: string): void {
    toast.warning(title, { description })
  },
  error(title: string, description?: string): void {
    // Errors linger — the operator has to be able to read them.
    toast.error(title, { description, duration: 10000 })
  },

  /**
   * Surface a failed API call.
   *
   * `auth` and `network` failures are configuration-level: they repeat on every
   * call until someone fixes the cause, so the screen fills with identical
   * toasts. Clearing first keeps it readable — and for `auth` the api layer is
   * already showing its own "session ended" toast plus a redirect, so this would
   * only be noise on top.
   */
  apiError(title: string, err: unknown, fallback = 'Unexpected error.'): void {
    if (err instanceof ApiError && (err.kind === 'auth' || err.kind === 'network')) {
      toast.dismiss()
    }
    notify.error(title, apiErrorMessage(err, fallback))
  },
}
