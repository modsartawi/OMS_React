import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import Input from '@/core/ui/Input'
import { VIEW_NAME_MAX, type NameRefusal } from './saved-view-store'

/** What the dialog reads of the view it renames. */
export interface NamedView {
  id: string
  name: string
}

/** Save current view / Save as new (a new view), or Rename (an existing one). */
export type ViewNameMode<V extends NamedView = NamedView> = { kind: 'save' } | { kind: 'rename'; view: V }

/**
 * The saved-view name dialog (ticket 400, spec 380 L12): on core `Modal`, replacing the
 * hand-rolled `fixed` overlay the old ViewManager drew. Its own failure — a name another of the
 * user's views holds — renders INSIDE the dialog, which stays open with the name as typed: a
 * toast would paint under the dialog's backdrop (377, F18).
 *
 * `onSubmit` returns the store's refusal, or `null` once it saved and the caller closed it.
 *
 * Born in the Deliveries list and graduated here (spec 3389 code review) with the Order / ERX
 * list (ticket 786) as its second reader: `ns` is the list's namespace (both hold `views.dialog.*`)
 * and `inputId` the name box's id (`view-name` on Deliveries, `order-view-name` on Orders).
 */
export default function ViewNameDialog({
  ns,
  inputId,
  mode,
  isTaken,
  onClose,
  onSubmit,
}: {
  ns: string
  inputId: string
  mode: ViewNameMode | null
  /** Whether another of the user's views holds the name (`exceptId` is the view being renamed). */
  isTaken: (name: string, exceptId?: string) => boolean
  onClose: () => void
  onSubmit: (name: string) => NameRefusal | null
}) {
  const { t } = useTranslation(ns)
  const refusalId = `${inputId}-refusal`
  const [name, setName] = useState('')
  const [refusal, setRefusal] = useState<NameRefusal | null>(null)

  // Each opening starts from the view's own name (Rename) or blank (Save).
  useEffect(() => {
    if (!mode) return
    setName(mode.kind === 'rename' ? mode.view.name : '')
    setRefusal(null)
  }, [mode])

  const exceptId = mode?.kind === 'rename' ? mode.view.id : undefined
  // Said as soon as it is typed, and again if the store refuses it on submit.
  const taken = name.trim() !== '' && isTaken(name, exceptId)
  const shown: NameRefusal | null = taken ? 'taken' : refusal
  const rename = mode?.kind === 'rename'

  function submit() {
    if (!name.trim() || taken) return
    setRefusal(onSubmit(name))
  }

  return (
    <Modal
      open={mode !== null}
      onClose={onClose}
      title={t(rename ? 'views.dialog.renameTitle' : 'views.dialog.saveTitle')}
      width="22rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('views.dialog.cancel')}
          </Button>
          <Button variant="primary" onClick={submit} disabled={!name.trim() || taken} data-view-dialog-submit="">
            {t(rename ? 'views.dialog.rename' : 'views.dialog.save')}
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-2"
        data-view-dialog=""
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <label htmlFor={inputId} className="text-xs font-medium text-muted-foreground">
          {t('views.dialog.nameLabel')}
        </label>
        <Input
          id={inputId}
          autoFocus
          autoComplete="off"
          maxLength={VIEW_NAME_MAX}
          aria-invalid={shown !== null}
          aria-describedby={shown ? refusalId : undefined}
          className="w-full"
          placeholder={t('views.dialog.namePlaceholder')}
          value={name}
          onChange={(e) => {
            setName(e.target.value)
            setRefusal(null)
          }}
        />
        {shown && (
          <div id={refusalId} data-view-dialog-refusal={shown}>
            <ErrorBanner message={t(`views.dialog.refused.${shown}`)} className="px-2.5 py-2" />
          </div>
        )}
        {!rename && <p className="text-xs text-muted-foreground">{t('views.dialog.captures')}</p>}
      </form>
    </Modal>
  )
}
