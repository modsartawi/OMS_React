import type { KeyboardEvent, RefObject } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Send } from 'lucide-react'
import KeyChord from '@/core/commands/KeyChord'
import { useKeyHint } from '@/core/commands/key-hint'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { canPost, type ComposerState } from './composer'

/** The composer form's own submit: from the box only, never a page key (K5). */
const POST_KEYS = 'Ctrl+Enter'

/** A post the server refused: its message and, when it sent one, its machine code. */
export interface ComposerFailure {
  message: string
  code: string | null
}

/**
 * The note composer at the spine's Now line (spec 380 D8, ticket 405; ruling 371 "Notes"). Add
 * note posts from here; the command bar's Add note…, `N` and the list's add-note intent all
 * focus it.
 *
 * Controlled: the page holds the text, because the page's Esc is refused while it is unsent.
 * Ctrl+Enter in the box is the form's own submit and is prevented, so the key layer never sees
 * it. An empty composer cannot post. A failed post shows here, inline, with the server's message
 * and code, and the text stays for another try.
 */
export default function NoteComposer({
  value,
  onChange,
  state,
  busy,
  failure,
  onPost,
  textareaRef,
  focusKeys,
}: {
  value: string
  onChange: (value: string) => void
  state: ComposerState
  /** Another command is in flight: the box stays editable, and Post waits. */
  busy: boolean
  failure: ComposerFailure | null
  onPost: () => void
  textareaRef: RefObject<HTMLTextAreaElement | null>
  /** The key that focuses the box, when it is bound (`N` on the delivery route). */
  focusKeys: string | null
}) {
  const { t } = useTranslation('document')
  const postHint = useKeyHint(POST_KEYS)
  const focusHint = useKeyHint(focusKeys)
  const posting = state === 'posting'
  const postable = canPost(state) && !busy

  const submit = () => {
    if (postable) onPost()
  }

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || !(event.ctrlKey || event.metaKey) || event.nativeEvent.isComposing) return
    event.preventDefault()
    submit()
  }

  return (
    <form
      data-composer={state}
      className="flex flex-col gap-1.5"
      onSubmit={(event) => {
        event.preventDefault()
        submit()
      }}
    >
      <label
        htmlFor="note-composer"
        className="flex items-center gap-1.5 text-[0.6875rem] font-bold tracking-wider text-ink-3 uppercase"
      >
        {t('composer.label')}
        {focusHint.ariaKeyShortcuts && focusKeys && <KeyChord keys={focusKeys} />}
      </label>
      <textarea
        id="note-composer"
        ref={textareaRef}
        rows={2}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        // Locked while it posts: what the success clears is exactly what was sent.
        readOnly={posting}
        aria-keyshortcuts={focusHint.ariaKeyShortcuts}
        aria-describedby={failure ? 'note-composer-failure' : undefined}
        placeholder={t('composer.placeholder')}
        className="min-h-14 w-full resize-y rounded-md border border-input bg-card px-2 py-1.5 text-[0.8125rem]"
      />
      <div className="flex items-center gap-2 text-[0.6875rem] text-muted-foreground">
        <span data-composer-hint="">
          <Trans t={t} i18nKey="composer.hint" components={{ keys: <KeyChord keys={POST_KEYS} /> }} />
        </span>
        <Button
          type="submit"
          variant="outlined"
          className="ms-auto"
          disabled={!postable}
          title={postHint.title(t('composer.post'))}
          aria-keyshortcuts={postHint.ariaKeyShortcuts}
          data-composer-post=""
        >
          {posting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Send className="h-3.5 w-3.5 rtl:-scale-x-100" aria-hidden />
          )}
          {t('composer.post')}
        </Button>
      </div>
      {failure && (
        <div id="note-composer-failure" data-composer-failure="">
          <ErrorBanner title={t('composer.failedTitle')} message={failure.message} className="px-3 py-2">
            {failure.code && (
              <p className="text-xs" data-composer-code="">
                <Trans t={t} i18nKey="composer.code" values={{ code: failure.code }} components={{ code: <Ltr /> }} />
              </p>
            )}
          </ErrorBanner>
        </div>
      )}
    </form>
  )
}
