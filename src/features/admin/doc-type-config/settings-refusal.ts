/**
 * The server's refusal of a document type's settings (BackOffice ticket 3150): `SDC-00010` carries every refused field
 * in `data.fields` (`SdDocTypeSettingsRefusal`), each with its own code (`SDC-00011..19`) and a bilingual message. The
 * dialog shows each message on its field. Pure: no React, no `t`.
 */
import { apiErrorCode, apiErrorData } from '@/core/api'
import { DOC_TYPE_CONFIG_ERRORS } from './api'
import { wireField } from './field-meta'
import type { DocumentTypeField } from './types'

export interface FieldRefusal {
  code: string
  message: string
}

export type FieldRefusals = Partial<Record<DocumentTypeField, FieldRefusal>>

/** The refused fields of a save error, by settings key; empty for any other error or a malformed body. */
export function settingsRefusals(err: unknown): FieldRefusals {
  if (apiErrorCode(err) !== DOC_TYPE_CONFIG_ERRORS.settingsRefused) return {}
  const data = apiErrorData(err)
  const fields = typeof data === 'object' && data !== null ? (data as { fields?: unknown }).fields : null
  if (!Array.isArray(fields)) return {}
  const out: FieldRefusals = {}
  for (const f of fields) {
    if (typeof f !== 'object' || f === null) continue
    const { field, errorCode, message } = f as Record<string, unknown>
    if (typeof field !== 'string' || typeof errorCode !== 'string' || typeof message !== 'string') continue
    out[wireField(field) as DocumentTypeField] = { code: errorCode, message }
  }
  return out
}
