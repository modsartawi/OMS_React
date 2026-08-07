/* PROTOTYPE — throwaway. Wayfinder ticket 247 (map 240).
 *
 * One printed A4 side. Shared by all three variants because it is 241's print
 * GEOMETRY, not anybody's design: the variants disagree about the document, not
 * about the sheet it lands on. The classes are styled by the host page's
 * PRINT_CSS, exactly as ticket 246 wrote them.
 */
export default function Sheet({ children }: { children: React.ReactNode }) {
  return (
    <div className="pv-sheet">
      <div className="pv-doc">{children}</div>
    </div>
  )
}
