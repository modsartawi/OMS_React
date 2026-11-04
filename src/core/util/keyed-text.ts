/**
 * A sentence as an i18n key and its interpolation, decided by a pure module and said by the
 * component (`t(text.key, text.params)` or a `<Trans>` with slots). Pure modules return this rather
 * than words so they stay free of `t`.
 */
export interface KeyedText<K extends string = string, P extends Record<string, unknown> = Record<string, string>> {
  key: K
  params?: P
}
