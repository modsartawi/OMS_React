// The one "is this a JSON object?" guard. Pure: no React, no `t`.

/** True for a non-null, non-array object — the shape `JSON.parse` gives for `{…}`. */
export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}
