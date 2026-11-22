import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { helpImageQuery } from '@/core/help/help-api'
import type { HelpLang } from '@/core/models/help'

/**
 * One help picture (oms 951): its bytes fetched through `api.blob` (the image route is behind login, and a plain
 * `<img src="/api/…">` cannot send the `X-Web-Client` header), shown through an object URL revoked on unmount.
 */
export default function HelpImage({ area, file, alt, lang }: { area: string; file: string; alt: string; lang: HelpLang }) {
  const { t } = useTranslation('help', { lng: lang })
  const read = useQuery(helpImageQuery(area, file))
  const url = useObjectUrl(read.data?.blob ?? null)
  return (
    <span className="my-3 block" data-help-image={file}>
      {url ? (
        <img src={url} alt={alt} className="max-w-full rounded-md border border-border" />
      ) : read.isError ? (
        <span className="text-xs text-muted-foreground">{t('article.imageMissing')}</span>
      ) : (
        <span className="block h-32 w-full animate-pulse rounded-md bg-muted" aria-hidden />
      )}
    </span>
  )
}

/** An object URL for `blob`, made in an effect and revoked when it changes or the picture unmounts. */
function useObjectUrl(blob: Blob | null): string | null {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    if (!blob) {
      setUrl(null)
      return
    }
    const next = URL.createObjectURL(blob)
    setUrl(next)
    return () => URL.revokeObjectURL(next)
  }, [blob])
  return url
}
