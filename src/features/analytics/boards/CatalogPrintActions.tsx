import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { toast } from 'sonner'
import Button from '@/core/ui/Button'
import { saveBlob } from '@/core/util/download-file'
import { analyticsApi } from './api'
import { catalogPdfName, pdfRefusal } from './catalog-print'
import { refusalWords } from './wire'

/**
 * The Catalog page's Print control (ticket 845, BackOffice spec 3437 §G, story 52; ruling 6): one PDF per language,
 * English or Arabic — `POST Analytics/Catalog/Render { lang }` renders the print route on the server and answers the
 * file, which is saved as the server names it. Every viewer may print.
 */
export default function CatalogPrintActions() {
  const { t } = useTranslation('boards')
  const render = useMutation({
    mutationFn: (lang: 'en' | 'ar') => analyticsApi.catalogPdf(lang),
    onSuccess: (file, lang) => saveBlob(file.filename ?? catalogPdfName(lang), file.blob),
    onError: (err) => toast.error(refusalWords(pdfRefusal(err, t('catalog.print.failed')), t)),
  })
  const working = render.isPending
  return (
    <div className="ms-auto flex flex-wrap items-center gap-2" role="group" aria-label={t('catalog.print.choose')} data-catalog-print>
      <Printer className="size-4 text-muted-foreground" aria-hidden />
      <span className="text-sm text-muted-foreground">{working ? t('catalog.print.working') : t('catalog.print.action')}</span>
      {(['en', 'ar'] as const).map((lang) => (
        <Button key={lang} variant="outlined" disabled={working} onClick={() => render.mutate(lang)} data-catalog-print-lang={lang}>
          {t(lang === 'ar' ? 'catalog.print.arabic' : 'catalog.print.english')}
        </Button>
      ))}
    </div>
  )
}
