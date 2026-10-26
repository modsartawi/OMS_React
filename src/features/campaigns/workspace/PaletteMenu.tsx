import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import type { RuleBlockCatalogue, RuleBlockKind, RuleCatalogueBlock } from '@/core/models/rule-campaign'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import { paletteFor } from './palette'
import IconButton from '@/core/ui/IconButton'

/**
 * "+ Condition" / "+ Effect" (ticket 505): a button that opens the palette in place, the catalogue's
 * blocks grouped by category, each named in HQ's words — only those HQ lists for the campaign's
 * features, never one it marks undecided (`./palette`). A pick adds the block and closes the palette;
 * Escape and Close close it too, and focus goes back to the button.
 */
export default function PaletteMenu({
  kind,
  label,
  palette: catalogue,
  everything,
  onPick,
  data,
}: {
  kind: RuleBlockKind
  /** The button's words. */
  label: string
  /** The catalogue HQ answers for the campaign's features. */
  palette: RuleBlockCatalogue
  /** The catalogue with every feature on: what an off feature would add. */
  everything: RuleBlockCatalogue
  onPick: (block: RuleCatalogueBlock) => void
  data: string
}) {
  const { t, i18n } = useTranslation('campaign-workspace')
  const [open, setOpen] = useState(false)
  const opener = useRef<HTMLSpanElement>(null)
  const first = useRef<HTMLButtonElement>(null)
  /** Set by Close and Escape: focus goes back to the button once it is drawn again. */
  const refocus = useRef(false)

  useEffect(() => {
    if (open) first.current?.focus()
    else if (refocus.current) {
      refocus.current = false
      opener.current?.querySelector('button')?.focus()
    }
  }, [open])

  const close = () => {
    refocus.current = true
    setOpen(false)
  }

  if (!open)
    return (
      <span ref={opener}>
        <Button variant="outlined" onClick={() => setOpen(true)} aria-expanded={false} data-palette-open={data}>
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {label}
        </Button>
      </span>
    )

  const palette = paletteFor(catalogue, kind, everything)
  const title = t(kind === 'condition' ? 'palette.condition' : 'palette.effect')
  return (
    <div
      role="group"
      aria-label={title}
      className="flex flex-col gap-3 rounded-lg border border-border bg-card p-3 shadow-sm"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.stopPropagation()
          close()
        }
      }}
      data-palette={data}
      data-palette-kind={kind}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-1.5 text-sm font-semibold">
          <Plus className="h-4 w-4" aria-hidden />
          {title}
        </span>
        <IconButton label={t('palette.close')} onClick={close} data-palette-close="">
          <X className="h-4 w-4" aria-hidden />
        </IconButton>
      </div>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
        {palette.groups.map((g, gi) => (
          <div key={g.group.id} className="flex flex-col gap-1" data-palette-group={g.group.id}>
            <div className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <bdi>{saysIn(g.group.name, i18n.language)}</bdi>
            </div>
            {g.blocks.map((b, bi) => (
              <button
                key={b.type}
                ref={gi === 0 && bi === 0 ? first : undefined}
                type="button"
                className="rounded-md px-2 py-1 text-start text-sm hover:bg-accent focus-visible:bg-accent"
                onClick={() => {
                  setOpen(false)
                  onPick(b)
                }}
                data-palette-block={b.type}
              >
                <bdi>{saysIn(b.name, i18n.language)}</bdi>
              </button>
            ))}
          </div>
        ))}
      </div>
      {palette.hiddenFeatures.map((f) => (
        <p key={f} className="text-xs text-muted-foreground" data-palette-hidden={f}>
          {t(`palette.hidden.${f}`)}
        </p>
      ))}
    </div>
  )
}
