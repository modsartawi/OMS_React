import { useTranslation } from 'react-i18next'
import { slotColour } from '@/core/charts/slots'
import Chip from '@/core/ui/Chip'
import { fsi } from '@/core/util/bidi'

/**
 * The view editor's series colours (766 §F, ticket 775): the coloured breakdown's members on screen, each with
 * the five chart-token slots. A breakdown with inline values has fixed colours (`fixedLabel` names it); an open
 * one's pick is reported up (`onPick`), which swaps so no two members share a slot.
 */
export default function ColourPicker({
  fixedLabel,
  members,
  onScreen,
  onPick,
}: {
  /** The breakdown's label when its colours are fixed by the model; `null` for an open breakdown. */
  fixedLabel: string | null
  members: string[]
  /** Each member's slot as it will be saved. */
  onScreen: Record<string, number>
  onPick: (member: string, slot: number) => void
}) {
  const { t } = useTranslation('boards')
  return (
        <div className="flex flex-col gap-1.5" data-analytics-colours>
          <span className="text-xs font-medium text-muted-foreground">{t('editor.colours')}</span>
          {fixedLabel !== null ? (
            <p className="text-xs text-muted-foreground">{t('editor.coloursFixed', { dimension: fsi(fixedLabel) })}</p>
          ) : members.length === 0 ? (
            <p className="text-xs text-muted-foreground">{t('editor.coloursNone')}</p>
          ) : (
            <ul className="flex flex-col gap-1">
              {members.map((m) => (
                <li key={m} className="flex items-center gap-2" data-analytics-colour-member={m}>
                  <span className="min-w-16 text-xs">
                    <bdi>{m}</bdi>
                  </span>
                  <div className="flex gap-1" role="group" aria-label={t('editor.colourFor', { member: fsi(m) })}>
                    {[0, 1, 2, 3, 4].map((s) => (
                      <Chip
                        key={s}
                        on={onScreen[m] === s}
                        className="px-1.5"
                        aria-label={t('editor.colourSlot', { n: s + 1 })}
                        onClick={() => onPick(m, s)}
                        data-colour-slot={s}
                      >
                        <span className="block size-3 rounded-full" style={{ background: slotColour(s) }} aria-hidden />
                      </Chip>
                    ))}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
  )
}
