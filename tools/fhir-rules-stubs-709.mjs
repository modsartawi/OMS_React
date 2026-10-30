// oms 709: the rejection report's rows and the guard draft they open. Nothing new on the wire: 3292's "draft endpoint"
// is not called, because the row seeds the editor and the author's Save is the existing `PUT InsuranceRules/Guards/Draft`.
// A row with a code and a row with only words reuse the shared REJECTIONS; a code in the conflict shape is added here.
import { REJECTIONS } from './insurance-rules-stubs.mjs'

export const REJECTIONS_709 = [...REJECTIONS, { code: 'ER', words: null, payer: 'BUPA', sameKind: 'E0555', count: 2, sar: 100, liveGuard: false }]
