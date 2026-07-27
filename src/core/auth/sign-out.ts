import { api } from '@/core/api'
import { navigateTo } from '@/core/nav'
import { useSession } from '@/core/session'

/**
 * End the session and go to login.
 *
 * It lives in `@/core/` because it has **two** consumers that may not import one
 * another: the shell's user menu (`layout/`) and the call-center console's
 * chrome-less refusal, which has no nav to leave by and so carries its own way
 * out (134 §8). A feature may never import another feature, so the shared piece
 * graduates up rather than being copied (`.claude/rules/feature-structure.md`).
 *
 * Best-effort by design: the local session is cleared and the redirect happens
 * even if `Auth/Logout` fails, because a failed server call must not strand an
 * operator on a screen they asked to leave.
 */
export async function signOut(): Promise<void> {
  try {
    await api.post('Auth/Logout', {})
  } catch {
    /* ignore — clear + redirect regardless */
  }
  useSession.getState().clear()
  navigateTo('/login')
}
