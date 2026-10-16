import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useBlocker } from 'react-router'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'

/**
 * Leaving a workspace page with unsaved changes asks first (the rule builder, 505; each Settings
 * page, 509): in the app, ours; closing or reloading the tab, the browser's own question. The login
 * bounce is core/api's and is never held. `words` is the locale prefix of the page's own wording
 * (`title`, `body`, `stay`, `go`).
 */
export default function LeaveGuard({ dirty, words }: { dirty: boolean; words: 'builder.leave' | 'settings.leave' }) {
  const { t } = useTranslation('campaign-workspace')
  useEffect(() => {
    if (!dirty) return
    const warn = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [dirty])
  const blocker = useBlocker(
    useCallback(
      ({ currentLocation, nextLocation }) => dirty && nextLocation.pathname !== '/login' && currentLocation.pathname !== nextLocation.pathname,
      [dirty],
    ),
  )
  return (
    <Modal
      open={blocker.state === 'blocked'}
      onClose={() => blocker.reset?.()}
      title={t(`${words}.title`)}
      footer={
        <>
          <Button variant="text" onClick={() => blocker.reset?.()} data-leave-stay="">
            {t(`${words}.stay`)}
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()} data-leave-go="">
            {t(`${words}.go`)}
          </Button>
        </>
      }
    >
      <p className="text-sm" data-leave-dialog="">
        {t(`${words}.body`)}
      </p>
    </Modal>
  )
}
