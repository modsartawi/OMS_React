// oms 698 (BackOffice spec 3271; doors 3284, 3293, 3297): what publish warns of and refuses.
// 🚩 STUBBED: the warnings are written here, on the Validate answer, in a guessed shape listed on ticket 698 for 711.
// `kind`, `fact` and `channel` on an issue, and the code RULES_OVERRIDES_PAYER, are guesses. The client computes none of it.
import { envelope, validateGuards, validateRuleset } from './insurance-rules-stubs.mjs'

const warning = (ruleId, kind, fact, channel, en, ar) => ({ ruleId, blockPath: null, field: null, severity: 'warning', kind, fact, channel, en, ar })

/** All three warnings on one rule, and one of a kind this client has never heard of. */
export const publishWarnings = (ruleId) => [
  warning(ruleId, 'channelNever', '$claimResponse.benefit', 'bupa', 'On bupa this condition is always unknown.', 'على بوبا هذا الشرط غير معروف دائماً.'),
  warning(ruleId, 'fieldFlagged', '$claimResponse.copay', null, 'This field is flagged by drift: its answer rate fell below half.', 'على هذا الحقل تنبيه انحراف: انخفض معدل الإجابة إلى أقل من النصف.'),
  warning(ruleId, 'arabicMissing', '$claim.category[*]', null, 'The Arabic text would show an English label or a bare code.', 'سيعرض النص العربي تسمية إنجليزية أو رمزاً مجرداً.'),
  warning(ruleId, 'someNewKind', '$claim.total', null, 'HQ says something this client has no word for.', 'تقول الإدارة العامة شيئاً لا يعرفه هذا العميل.'),
]

// A3: the approved quantity, benefit, copay and patient share are the payer's. The stub reads `deductible` as the share.
const PAYER_KEYS = ['deductible', 'copay', 'benefit', 'approvedQuantity']
const overridesPayer = (doc) => (doc?.rules ?? []).filter((r) => (r.then ?? []).some((e) => e.overridesPayer && PAYER_KEYS.includes(e.effect)))

/**
 * Answers `POST …/Guards/Validate` and `…/Coverage/Validate` with the stubs' own checks plus these; null otherwise.
 * `opts.warnOn` is the guard rule that carries the warnings; `opts.coverageWarnOn` the coverage one. `opts.hold` is a
 * promise the Validate answer waits on, and `opts.lateRefusal` makes Validate miss what Approve then refuses.
 */
export async function publishChecksStub(method, path, body, opts = {}) {
  if (method !== 'POST') return null
  if (path === 'InsuranceRules/Guards/Validate') {
    await opts.hold
    return opts.fail ? envelope(null, { status: 500, success: false, message: 'Validate is down' }) : envelope([...validateGuards(body), ...(opts.warnOn ? publishWarnings(opts.warnOn) : [])])
  }
  if (path === 'InsuranceRules/Coverage/Validate') {
    if (opts.fail) return envelope(null, { status: 500, success: false, message: 'Validate is down' })
    const refusals = opts.lateRefusal
      ? []
      : overridesPayer(body).map((r) => ({
          ruleId: r.id,
          blockPath: 'then[0]',
          field: 'overridesPayer',
          severity: 'error',
          kind: 'overridesPayer',
          fact: `$request.${r.then[0].effect}`,
          channel: null,
          en: 'This value is the payer’s: a rule cannot override it.',
          ar: 'هذه القيمة تخص الشركة: لا يمكن لقاعدة تجاوزها.',
        }))
    return envelope([...validateRuleset(body), ...refusals, ...(opts.coverageWarnOn ? publishWarnings(opts.coverageWarnOn) : [])])
  }
  if (path === 'InsuranceRules/Coverage/Approve' && opts.lateRefusal)
    return envelope(null, { status: 409, success: false, errorCode: 'RULES_OVERRIDES_PAYER', message: 'The payer’s value cannot be overridden.' })
  return null
}
