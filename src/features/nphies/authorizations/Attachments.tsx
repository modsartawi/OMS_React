import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, Paperclip, TriangleAlert } from 'lucide-react'

import Button from '@/core/ui/Button'
import {
  ACCEPTED_FILE_TYPES,
  ATTACHMENT_TITLES,
  DEFAULT_ATTACHMENT_TITLE,
  PDF_MAX_BYTES,
  totalAttachmentBytes,
  type AttachmentRefusal,
  type AttachmentTitle,
  type PreparedAttachment,
} from './attachment-prepare'
import { prepareAttachment } from './attachment-file'

/**
 * **The files that evidence the request** (ticket 219, spec 209 stories 47–55,
 * contract v1.0 §3.5).
 *
 * 🚩 **File picker only, no camera.** Both audiences already hold the file — the
 * back office scans it, the call-centre agent is sent it — so a capture surface
 * would be a control nobody reaches for.
 *
 * 🚩 **The type dropdown dissolves.** The file's MIME derives `contentType`; the
 * only thing the agent chooses is *which document this is*, from a **closed
 * seven-value list** with no free-text escape, because the value reaches a
 * national exchange verbatim.
 *
 * 🚩 **The same title twice is allowed** — two prescriptions are two
 * prescriptions, and `sequence` already distinguishes the rows. This is the
 * deliberate opposite of the duplicate-item refusal at `addItem`.
 *
 * 🚩 **At least one attachment is mandatory, and that is a FORM STATE** — the
 * banner below and a disabled Submit — not an exception thrown after everything
 * else has been filled in.
 *
 * 🚩 **Preview is an inline lightbox off the same data URL that will be sent**,
 * so the agent previews exactly what goes. It is a plain overlay rather than a
 * `<dialog>`: no modal opens anywhere in this flow.
 */
export default function Attachments({
  attachments,
  onAdd,
  onRemove,
  disabled,
}: {
  attachments: PreparedAttachment[]
  /** Prepared in the browser and held here until `submit` carries it — there is
   *  no upload endpoint and no verb (§1.2). */
  onAdd: (attachment: PreparedAttachment) => void
  onRemove: (id: string) => void
  disabled: boolean
}) {
  const { t } = useTranslation('authorizations')
  const [title, setTitle] = useState<AttachmentTitle>(DEFAULT_ATTACHMENT_TITLE)
  const [refusal, setRefusal] = useState<AttachmentRefusal | null>(null)
  const [preparing, setPreparing] = useState(false)
  const [previewing, setPreviewing] = useState<PreparedAttachment | null>(null)
  const [failed, setFailed] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)
  const nextId = useRef(0)

  async function pick(file: File | null | undefined) {
    if (!file) return
    setRefusal(null)
    setFailed(false)
    setPreparing(true)
    try {
      nextId.current += 1
      const answer = await prepareAttachment(file, title, `A${nextId.current}`)
      if (!answer.ok) {
        setRefusal(answer.refusal)
        return
      }
      onAdd(answer.attachment)
    } catch {
      // A file the browser could not read or decode. Said plainly rather than
      // thrown — the agent's next act is to pick a different file.
      setFailed(true)
    } finally {
      setPreparing(false)
    }
  }

  const bytes = totalAttachmentBytes(attachments)

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">
          {t('form.attachments.title', { count: attachments.length })}
        </h2>
        <span className="text-xs text-muted-foreground">{t('form.attachments.accepts')}</span>
      </div>

      {/* 🚩 The mandatory attachment, as a form state. It is here from the moment
          the form opens, not after a submit has been refused. */}
      {attachments.length === 0 && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{t('form.attachments.mandatory')}</span>
        </div>
      )}

      <div className="flex flex-wrap items-end gap-2">
        <label className="flex w-56 flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('form.attachments.document')}
          <select
            value={title}
            disabled={disabled || preparing}
            aria-label={t('form.attachments.document')}
            onChange={(event) => setTitle(event.target.value as AttachmentTitle)}
            className="h-8 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            {/* A closed list. There is no "other", and no box to type into. */}
            {ATTACHMENT_TITLES.map((value) => (
              <option key={value} value={value}>
                {t(`form.attachments.titles.${value}`)}
              </option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="secondary"
          className="h-8"
          disabled={disabled || preparing}
          onClick={() => fileInput.current?.click()}
        >
          {preparing ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Paperclip className="h-3.5 w-3.5" aria-hidden />
          )}
          {preparing ? t('form.attachments.preparing') : t('form.attachments.choose')}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept={ACCEPTED_FILE_TYPES}
          aria-label={t('form.attachments.choose')}
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0]
            // Cleared before the await, so picking the same file twice still
            // fires a change — two prescriptions may genuinely be one file
            // attached twice.
            event.target.value = ''
            void pick(file)
          }}
        />
        <p className="min-w-[14rem] flex-1 text-xs text-muted-foreground">
          {t('form.attachments.duplicatesAllowed')}
        </p>
      </div>

      {refusal && (
        <p role="alert" className="flex items-start gap-2 text-xs text-attention-800">
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {refusal.reason === 'pdfTooLarge'
              ? t('form.attachments.refusal.pdfTooLarge', {
                  size: formatBytes(refusal.bytes, t),
                  cap: formatBytes(PDF_MAX_BYTES, t),
                })
              : t('form.attachments.refusal.unsupportedType')}
          </span>
        </p>
      )}
      {failed && (
        <p role="alert" className="text-xs text-attention-800">
          {t('form.attachments.refusal.unreadable')}
        </p>
      )}

      {attachments.length > 0 && (
        <ul className="flex flex-col gap-2">
          {attachments.map((attachment) => (
            <li
              key={attachment.id}
              className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card p-2.5"
            >
              {attachment.contentType.startsWith('image/') ? (
                <img
                  src={attachment.dataUrl}
                  alt=""
                  className="h-12 w-12 rounded-md border border-border object-cover"
                />
              ) : (
                <span className="flex h-12 w-12 items-center justify-center rounded-md border border-danger-border bg-danger-050 text-[0.625rem] font-semibold text-danger-800">
                  {t('form.attachments.pdfBadge')}
                </span>
              )}
              <span className="flex min-w-[12rem] flex-1 flex-col">
                <span className="text-sm font-medium">
                  {t(`form.attachments.titles.${attachment.title}`)}
                </span>
                {/* 🚩 Both figures, because the downscale is a claim otherwise. */}
                <span className="text-xs text-muted-foreground">
                  {t('form.attachments.sizes', {
                    fileName: attachment.fileName,
                    from: formatBytes(attachment.originalBytes, t),
                    to: formatBytes(attachment.bytes, t),
                  })}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setPreviewing(attachment)}
                className="inline-flex h-7 items-center rounded-full border border-border px-3 text-xs font-medium hover:bg-accent"
              >
                {t('form.attachments.view')}
              </button>
              <button
                type="button"
                disabled={disabled}
                onClick={() => {
                  // A preview of a row that is being removed closes with it —
                  // otherwise the lightbox goes on showing what is no longer
                  // attached.
                  if (previewing?.id === attachment.id) setPreviewing(null)
                  onRemove(attachment.id)
                }}
                className="inline-flex h-7 items-center rounded-full border border-danger-border px-3 text-xs font-medium text-danger-800 hover:bg-danger-050 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {t('form.attachments.remove')}
              </button>
            </li>
          ))}
        </ul>
      )}

      {attachments.length > 0 && (
        <p className="text-xs text-muted-foreground">
          {t('form.attachments.payload', { size: formatBytes(bytes, t) })}
        </p>
      )}

      {previewing && (
        <Lightbox attachment={previewing} onClose={() => setPreviewing(null)} />
      )}
    </section>
  )
}

/**
 * The inline preview — **off the same data URL that will be sent**, so what the
 * agent checks is what the payer gets. WPF opened a separate viewer window; this
 * is an overlay on the same page, and it is not a `<dialog>` because no modal
 * opens anywhere in this flow.
 */
function Lightbox({
  attachment,
  onClose,
}: {
  attachment: PreparedAttachment
  onClose: () => void
}) {
  const { t } = useTranslation('authorizations')

  // Escape closes it, because a full-screen overlay that only a mouse can
  // dismiss is a trap for anyone driving the form from the keyboard.
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/70 p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-full w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-card"
        onClick={(event) => event.stopPropagation()}
        role="group"
        aria-label={t('form.attachments.previewLabel', { fileName: attachment.fileName })}
      >
        <header className="flex items-center justify-between gap-3 border-b border-border/60 p-3">
          <span className="text-sm font-medium">
            {t('form.attachments.previewHeading', {
              title: t(`form.attachments.titles.${attachment.title}`),
              fileName: attachment.fileName,
            })}
          </span>
          <Button type="button" variant="secondary" className="h-7" onClick={onClose}>
            {t('form.attachments.close')}
          </Button>
        </header>
        <div className="overflow-auto bg-muted p-3 text-center">
          {attachment.contentType.startsWith('image/') ? (
            <img src={attachment.dataUrl} alt="" className="mx-auto max-w-full rounded-md" />
          ) : (
            <iframe
              src={attachment.dataUrl}
              title={t('form.attachments.previewLabel', { fileName: attachment.fileName })}
              className="h-[70vh] w-full rounded-md border-0 bg-background"
            />
          )}
        </div>
      </div>
    </div>
  )
}

type Translate = ReturnType<typeof useTranslation<'authorizations'>>['t']

/** A size a person can read. Kilobytes below a megabyte, one decimal above. */
function formatBytes(bytes: number, t: Translate): string {
  if (bytes >= 1024 * 1024) {
    return t('form.attachments.megabytes', { value: (bytes / (1024 * 1024)).toFixed(1) })
  }
  return t('form.attachments.kilobytes', { value: Math.max(1, Math.round(bytes / 1024)) })
}
