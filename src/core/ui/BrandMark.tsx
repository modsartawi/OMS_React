import logoUrl from '@/assets/Al-Dawaa-Pharmacies-01.svg'

// The al-dawaa logo file carries the gold mark AND the navy "al-dawaa / الدواء"
// wordmark stacked beneath it. The app pairs the mark with its own "BackOffice"
// wordmark (map 478 branding), and the navy text would vanish on dark grounds —
// so we crop the file to just the gold glyph via background-size/position. These
// constants frame the mark's bounding box (x≈[340,620], y≈[138,580] of the 1000²
// artboard); change them only if the source artwork's layout changes.
const MARK_SIZE = '217% 217%'
const MARK_POSITION = '46.4% 24.1%'

/**
 * The al-dawaa brand mark — the gold glyph, cropped from the full logo, on a
 * transparent ground so it sits on any surface (ivory card, navy panel, dark
 * header). Square by construction; drive the footprint with `size` (px).
 */
export default function BrandMark({
  size = 32,
  className,
}: {
  size?: number
  className?: string
}) {
  return (
    <span
      role="img"
      aria-label="al-dawaa"
      className={className}
      style={{
        display: 'inline-block',
        flex: 'none',
        width: size,
        height: size,
        backgroundImage: `url(${logoUrl})`,
        backgroundRepeat: 'no-repeat',
        backgroundSize: MARK_SIZE,
        backgroundPosition: MARK_POSITION,
      }}
    />
  )
}
