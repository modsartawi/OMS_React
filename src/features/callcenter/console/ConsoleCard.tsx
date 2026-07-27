/**
 * The one card every non-console state on this route is drawn in.
 *
 * The route is chrome-less by ruling (map 126 note 13), and that has a
 * consequence the whole screen has to keep paying: **there is no nav to leave
 * by**, so every state that is not the console itself owes the agent its own way
 * out (134 §8). A state the agent can only escape by closing the tab is the
 * failure 162 existed to prevent, and it is exactly the one a second card,
 * hand-rolled later, quietly reintroduces.
 *
 * So the ways home are not a prop and not a choice — they are part of the card.
 * The denial, the open failure, the state-read failure and 163's already-open
 * choice all come through here, which is what makes "every one of them can be
 * left" a property of this file rather than of four separate memories.
 */
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { signOut } from '@/core/auth/sign-out'

export default function ConsoleCard({
  tone,
  marker,
  width = 'max-w-md',
  children,
  /** The state's own actions. When present the ways home step back to a quiet
   *  footer row: on 163's screen the decision is *resume or start fresh*, and
   *  leaving is the third thing rather than a third peer. */
  actions,
}: {
  /** `attention` is the amber edge of a choice; `denied` the neutral one of a
   *  refusal. A refusal is not an emergency and is not coloured like one. */
  tone: 'denied' | 'attention'
  marker: string
  width?: string
  children: ReactNode
  actions?: ReactNode
}) {
  const { t } = useTranslation('callcenter')
  const edge = tone === 'attention' ? 'border-attention-border' : 'border-border'
  const quiet = actions !== undefined

  // Two presentations of the same two exits — buttons when they are the only
  // way forward, a footer row when the card already has its own actions.
  const wayHome = quiet
    ? 'text-xs text-muted-foreground underline-offset-2 hover:underline'
    : 'rounded-md border border-input bg-card px-4 py-2 text-sm font-medium hover:bg-accent'

  return (
    <div className="flex h-screen items-center justify-center bg-background p-8">
      <div
        className={`w-full ${width} rounded-lg border ${edge} bg-card p-6 shadow-sm`}
        role="alert"
        data-cc-notice={marker}
      >
        {children}
        {actions && <div className="mt-5 flex gap-2">{actions}</div>}
        <div
          className={
            quiet ? 'mt-4 flex gap-4 border-t border-border pt-3' : 'mt-5 flex justify-center gap-2'
          }
        >
          {/* An in-app link rather than a silent redirect — 125's
              explain-don't-redirect ruling: an agent teleported away never
              learns whether they were refused or the check merely failed. */}
          <Link to="/" data-cc-home className={wayHome}>
            {t('actions.backToPortal')}
          </Link>
          <button type="button" onClick={() => void signOut()} data-cc-signout className={wayHome}>
            {t('actions.signOut')}
          </button>
        </div>
      </div>
    </div>
  )
}
