import { useTranslation } from 'react-i18next'

/**
 * "How this is read" (BackOffice spec 4157 "How it is calculated"): a closed panel under a block that says, in the
 * reader's language, which rows the block read and by which rule. The words are the locale's `how.<section>.*` —
 * `title`, then the paragraphs named in `paragraphs` (`p1`, `p2`, …). A native `<details>`, so it opens without a
 * control of ours.
 */
export default function HowRead({ section, paragraphs }: { section: string; paragraphs: readonly string[] }) {
  const { t } = useTranslation('stock-console')
  return (
    <details className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-sm" data-how-read={section}>
      <summary className="cursor-pointer font-medium">{t(`how.${section}.title`)}</summary>
      <div className="mt-2 flex flex-col gap-2 text-muted-foreground">
        {paragraphs.map((p) => (
          <p key={p}>{t(`how.${section}.${p}`)}</p>
        ))}
      </div>
    </details>
  )
}
