import { useEffect, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { helpImageQuery } from '@/core/help/help-api'
import type { HelpLang } from '@/core/models/help'

/**
 * One help picture (oms 951): its bytes fetched through `api.blob` (the image route is behind login, and a plain
 * `<img src="/api/…">` cannot send the `X-Web-Client` header), shown through an object URL revoked on unmount.
 *
 * `onSettled` (the print page, oms 953) hears once that the picture has loaded or failed — its fetch or its decoding.
 * The picture is never cut across a page break.
 */
export default function HelpImage({ area, file, alt, lang, onSettled }: { area: string; file: string; alt: string; lang: HelpLang; onSettled?: (file: string) => void }) {
  const { t } = useTranslation('help', { lng: lang })
  const read = useQuery(helpImageQuery(area, file))
  const url = useObjectUrl(read.data?.blob ?? null)
  const settledRef = useRef(onSettled)
  settledRef.current = onSettled
  const settle = () => settledRef.current?.(file)
  useEffect(() => {
    if (read.isError) settledRef.current?.(file)
  }, [read.isError, file])
  return (
    <span className="my-3 block [break-inside:avoid]" data-help-image={file}>
      {url ? (
        // The capture script (scripts/help-shots) shoots at 2× pixels, so `2x` draws a shot at the size it had on screen.
        // The height cap keeps every picture well inside one A4 page: a taller one would spill onto a page the print's
        // contents numbers (`pagesOfBlocks`) do not count, and on screen it would need scrolling to see whole.
        <img
          src={url}
          srcSet={`${url} 2x`}
          alt={alt}
          onLoad={settle}
          onError={settle}
          className="h-auto max-h-[34rem] w-auto max-w-full rounded-md border border-border object-contain"
        />
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
