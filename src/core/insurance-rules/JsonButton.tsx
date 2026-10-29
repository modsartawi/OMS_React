import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Braces, Copy, Loader2 } from 'lucide-react'
import Button from '@/core/ui/Button'
import Modal from '@/core/ui/Modal'

/**
 * "JSON" (ticket 656): a guard document, a rule or a template exactly as HQ stores it — the SIS.Rules rule language,
 * after the wire codec (`guard-wire`), so what the author reads is what the engine runs. Read-only, with Copy. The
 * caller passes the wire value already built; `undefined` while it is still loading. The JSON is one left-to-right
 * island, in Arabic too. Shared by the Guards list, the rule page, the editor and the Templates gallery.
 */
export default function JsonButton({ title, value, hook }: { title: string; value: unknown; hook: string }) {
  const { t } = useTranslation('insurance-rules')
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)} data-json-open={hook}>
        <Braces className="h-3.5 w-3.5" aria-hidden />
        {t('json.button')}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={title} width="52rem">
        {open && <JsonBody value={value} hook={hook} />}
      </Modal>
    </>
  )
}

function JsonBody({ value, hook }: { value: unknown; hook: string }) {
  const { t } = useTranslation('insurance-rules')
  const pre = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const text = value === undefined ? '' : JSON.stringify(value, null, 2)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      // No clipboard (an insecure origin, a refused permission): select the text for Ctrl+C instead.
      const node = pre.current
      const selection = window.getSelection()
      if (!node || !selection) return
      const range = document.createRange()
      range.selectNodeContents(node)
      selection.removeAllRanges()
      selection.addRange(range)
    }
  }

  if (value === undefined)
    return (
      <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('json.loading')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2" data-json-view={hook}>
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-xs text-muted-foreground">{t('json.lede')}</p>
        <Button variant="secondary" className="ms-auto" onClick={() => void copy()} data-json-copy="">
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {t(copied ? 'json.copied' : 'json.copy')}
        </Button>
      </div>
      <pre ref={pre} dir="ltr" className="max-h-[70vh] overflow-auto rounded-md bg-muted p-3 font-mono text-xs whitespace-pre" data-json-body="">
        {text}
      </pre>
    </div>
  )
}
