import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import { readPaste, type PasteKind } from './paste'

/**
 * Paste item or category codes into a filter (oms 618 walk: a list of 2,000 items is pasted, not picked). What
 * the paste reads is counted as it is typed: new codes, codes already there, and tokens that are not codes.
 */
export default function PasteCodes({ open, kind, held, onAdd, onClose }: { open: boolean; kind: PasteKind; held: readonly string[]; onAdd: (codes: string[]) => void; onClose: () => void }) {
  const { t } = useTranslation('insurance-lists')
  const [text, setText] = useState('')
  const read = readPaste(text, kind, held)
  const close = () => {
    setText('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={t(`paste.${kind}.title`)}
      width="36rem"
      footer={
        <>
          <Button variant="text" onClick={close} data-paste-cancel="">
            {t('editor.cancel')}
          </Button>
          <Button
            variant="primary"
            aria-disabled={read.added.length === 0}
            onClick={() => {
              if (read.added.length === 0) return
              onAdd(read.added)
              close()
            }}
            data-paste-add=""
          >
            {t('paste.add', { count: read.added.length, n: fsi(read.added.length) })}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-paste={kind}>
        <Field label={t(`paste.${kind}.label`)} hint={t('paste.hint')}>
          <Textarea dir="ltr" rows={12} className="w-full font-mono" value={text} onChange={(e) => setText(e.target.value)} data-paste-text="" />
        </Field>
        <p className="text-sm" data-paste-read="">
          {t('paste.new', { count: read.added.length, n: fsi(read.added.length) })}
          {read.repeated > 0 && <span className="text-muted-foreground"> {t('paste.repeated', { count: read.repeated, n: fsi(read.repeated) })}</span>}
        </p>
        {read.rejected.length > 0 && (
          <div className="rounded-md border border-attention-border bg-attention-050 p-2 text-sm" role="alert" data-paste-rejected={read.rejected.length}>
            <p>{t(`paste.${kind}.rejected`, { count: read.rejected.length, n: fsi(read.rejected.length) })}</p>
            <p className="mt-1 max-h-24 overflow-auto font-mono text-xs">
              <Ltr>{read.rejected.slice(0, 50).join(' ')}</Ltr>
            </p>
          </div>
        )}
      </div>
    </Modal>
  )
}
