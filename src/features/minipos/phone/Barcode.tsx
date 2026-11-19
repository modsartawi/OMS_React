import { code128Bars, code128Modules } from './code128'

/** Quiet zone each side, in modules: Code 128 asks for ten. */
const QUIET = 10
const HEIGHT = 50

/**
 * The order number as a large Code 128 barcode (spec 4032 story 22): the cashier scans it off the phone with "Find in
 * Orders". Black bars on a white ground in either theme, because a scanner needs the contrast the code was made for
 * (the palette gate's allowlist names this file, as it names the login QR's quiet zone).
 */
export default function Barcode({ value, label }: { value: string; label: string }) {
  const width = code128Modules(value).length + 2 * QUIET
  return (
    <svg
      role="img"
      aria-label={label}
      data-barcode={value}
      viewBox={`0 0 ${width} ${HEIGHT}`}
      preserveAspectRatio="none"
      shapeRendering="crispEdges"
      className="block h-36 w-full rounded-md bg-white"
    >
      {code128Bars(value).map(([x, w]) => (
        <rect key={x} x={x + QUIET} y={0} width={w} height={HEIGHT} className="fill-black" />
      ))}
    </svg>
  )
}
