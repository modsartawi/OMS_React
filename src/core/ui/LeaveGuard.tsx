import { useCallback, useEffect } from 'react'
import { useBlocker } from 'react-router'
import Button from './Button'
import Modal from './Modal'

/** A leave dialog's words, already translated by the page that owns them. */
export interface LeaveWords {
  title: string
  body: string
  stay: string
  go: string
}

/**
 * Leaving a page with unsaved changes asks first: in the app, this dialog; closing or reloading the
 * tab, the browser's own question. The login bounce is core/api's and is never held. Graduated from
 * the campaign workspace (505, 509) when Priority (513) needed it too.
 */
export default function LeaveGuard({ dirty, words }: { dirty: boolean; words: LeaveWords }) {
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
      title={words.title}
      footer={
        <>
          <Button variant="text" onClick={() => blocker.reset?.()} data-leave-stay="">
            {words.stay}
          </Button>
          <Button variant="danger" onClick={() => blocker.proceed?.()} data-leave-go="">
            {words.go}
          </Button>
        </>
      }
    >
      <p className="text-sm" data-leave-dialog="">
        {words.body}
      </p>
    </Modal>
  )
}
