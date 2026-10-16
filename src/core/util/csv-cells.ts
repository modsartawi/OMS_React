/**
 * One line of a CSV as its cells, trimmed. A quoted cell may hold the separator and `""` for a
 * quote. A line, not a file: a quoted line break is not read (the readers split on lines first).
 *
 * Graduated at ticket 516, when the coupon import became the second reader of the rule simulator's
 * basket CSV (ticket 514) — features may not import each other. Each reader keeps its own choice of
 * separator and its own columns; this is only the part that was the same.
 */
export function csvCells(line: string, sep: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      cell = ''
      quoted = true
    } else if (ch === sep) {
      cells.push(cell.trim())
      cell = ''
    } else cell += ch
  }
  cells.push(cell.trim())
  return cells
}
