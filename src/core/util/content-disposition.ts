/**
 * Reading a download's file name off its `Content-Disposition` header — the pure
 * half of `api.blob` (ticket 262), kept out of `core/api.ts` so it can be tested
 * without a stubbed `fetch`.
 *
 * The real header from SIS.Api's render rail carries **both** forms at once:
 *
 * ```
 * attachment; filename="Invoice-P001-REG-01-O426250B87CB7A.pdf"; filename*=UTF-8''Invoice-…
 * ```
 *
 * so the reader has to prefer the RFC 5987 `filename*` (it is the one that can
 * carry non-ASCII, and a server that sends both means the plain one as the
 * degraded twin) and fall back to plain `filename` when it is alone.
 *
 * 🚩 **A `;` inside the quoted value must not split the parameter.** A naive
 * `header.split(';')` reads `filename="Invoice; final.pdf"` as two parameters and
 * saves the file as `Invoice`, which is why this walks the string with a quote
 * flag instead.
 */

/** Split a header's parameters on `;`, ignoring separators inside a quoted value. */
function splitParameters(header: string): string[] {
  const parts: string[] = []
  let current = ''
  let quoted = false
  for (let i = 0; i < header.length; i++) {
    const char = header[i]
    if (quoted) {
      // A backslash escape carries its next character through verbatim, so an
      // escaped quote cannot end the value.
      if (char === '\\' && i + 1 < header.length) {
        current += char + header[++i]
        continue
      }
      if (char === '"') quoted = false
      current += char
      continue
    }
    if (char === '"') {
      quoted = true
      current += char
      continue
    }
    if (char === ';') {
      parts.push(current)
      current = ''
      continue
    }
    current += char
  }
  parts.push(current)
  return parts
}

/** Strip surrounding quotes and un-escape `\x` inside them. Unquoted values pass through. */
function unquote(value: string): string {
  const trimmed = value.trim()
  if (trimmed.length < 2 || !trimmed.startsWith('"') || !trimmed.endsWith('"')) return trimmed
  return trimmed.slice(1, -1).replace(/\\(.)/g, '$1')
}

/**
 * The file name a `Content-Disposition` header names, or `null` when it names
 * none — an absent header, a header with no `filename` parameter, or a
 * `filename*` whose percent-encoding does not decode.
 *
 * Returning `null` rather than a guess is the point: the caller has a real
 * fallback of its own (the key it asked for), and a half-decoded name on disk is
 * worse than the name the caller would have chosen.
 */
export function filenameFromDisposition(header: string | null | undefined): string | null {
  if (!header) return null

  let plain: string | null = null
  let extended: string | null = null

  for (const part of splitParameters(header)) {
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const name = part.slice(0, eq).trim().toLowerCase()
    const rawValue = part.slice(eq + 1)
    if (name === 'filename' && plain === null) {
      plain = unquote(rawValue) || null
      continue
    }
    if (name === 'filename*' && extended === null) {
      // RFC 5987: charset'language'percent-encoded-value. The charset is
      // effectively always UTF-8 here; `decodeURIComponent` reads that.
      const value = unquote(rawValue)
      const match = /^[^']*'[^']*'(.*)$/.exec(value)
      const encoded = match ? match[1] : null
      if (!encoded) continue
      try {
        extended = decodeURIComponent(encoded) || null
      } catch {
        /* a malformed escape sequence — fall back to the plain form */
      }
    }
  }

  return extended ?? plain
}
