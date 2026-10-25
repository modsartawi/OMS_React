// The raw body of a delivery-rail webhook, for a read-only view. Graduated from the Deliverect
// orders monitor (ticket 478) by ticket 556 — the HungerStation orders monitor's raw view is its
// second reader. Pure: no React, no `t`.

/**
 * The raw body for display: re-indented (2 spaces) ONLY when it parses as JSON, else exactly as
 * received. `pretty` says which — the viewer offers the verbatim text either way.
 *
 * 🚩 Never `JSON.stringify(JSON.parse(body))`: that rewrites VALUES — `1.10` becomes `1.1`, a
 * 20-digit number loses digits, `A` becomes `A` — and a disputed order is checked against
 * exactly those. Here the parse only decides WHETHER to indent; the indenting walks the text and
 * copies every string, number and literal token byte for byte, changing white space alone.
 */
export function rawView(body: string): { text: string; pretty: boolean } {
  try {
    JSON.parse(body)
  } catch {
    return { text: body, pretty: false }
  }
  return { text: reindent(body), pretty: true }
}

/** Re-indent valid JSON text: white space outside strings is dropped and laid out again. */
function reindent(json: string): string {
  let out = ''
  let depth = 0
  const newline = () => '\n' + '  '.repeat(depth)
  for (let i = 0; i < json.length; i++) {
    const c = json[i]
    if (c === '"') {
      // A string token, copied verbatim up to its closing quote (escapes included).
      let j = i + 1
      while (json[j] !== '"') j += json[j] === '\\' ? 2 : 1
      out += json.slice(i, j + 1)
      i = j
    } else if (c === '{' || c === '[') {
      // An empty object or array stays on one line.
      let j = i + 1
      while (/\s/.test(json[j])) j++
      if (json[j] === (c === '{' ? '}' : ']')) {
        out += c + json[j]
        i = j
      } else {
        depth++
        out += c + newline()
      }
    } else if (c === '}' || c === ']') {
      depth--
      out += newline() + c
    } else if (c === ',') {
      out += ',' + newline()
    } else if (c === ':') {
      out += ': '
    } else if (!/\s/.test(c)) {
      out += c
    }
  }
  return out
}
