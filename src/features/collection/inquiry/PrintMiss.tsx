import { useTranslation } from 'react-i18next'
import { FileX2 } from 'lucide-react'

/**
 * What a print route renders instead of a document when the id does not resolve.
 *
 * ⚠ This is CHROME, not a facsimile: it holds none of the documents' three-rule
 * exception. Every string goes through `t()`, the utilities are logical and the
 * colours are tokens, exactly like any other screen.
 *
 * Never a blank A4 sheet — a blank sheet prints as convincingly as a real one
 * (spec 249, story 91). Shared by the receipt and the ACR because the two misses
 * are the same fact told to the same reader; 245 §7 gives them different envelope
 * codes (`CollectionReceiptNotFound`, `AcrNotFound`) but the same sentence, so
 * ticket 259 replaces the fixture lookups above it and leaves this alone.
 */
export default function PrintMiss() {
  const { t } = useTranslation('collection')
  return (
    <div className="mx-auto mt-16 max-w-md p-6 text-center" role="alert">
      <FileX2 className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('document.missingTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('document.missingHint')}</p>
    </div>
  )
}
