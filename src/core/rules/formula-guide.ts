// What the guided ƒx helper offers (ticket 507): the fields a formula may read, the functions and
// operators of the expression language, and ready-made recipes. HQ's catalogue (`Rules/Authoring/
// Catalogue`, BackOffice 2758) carries none of it — it lists blocks only — so the guide is the
// client's, written to the language of ADR 0089 as the SIS.Rules checker reads it: the paths are the
// ones the checker knows, and every snippet and recipe is text `./expr` reads (ticket 523 moved it
// here from the stubbed catalogue it was invented on). The words around each entry live in the
// `campaign-workspace` bundle.

/** What a formula field, value or result is — its type badge. */
export type RuleFormulaType = 'money' | 'number' | 'text' | 'date' | 'items' | 'bool'

/** What a formula box needs: a named value is a number, the formula condition a yes / no test. */
export type RuleFormulaExpect = 'number' | 'bool'

/** A field a rule may read (`session.total`, `profile.tier`, `item.net` …). */
export interface RuleFormulaField {
  path: string
  type: RuleFormulaType
  /** The Fields list's group (`sale`, `profile`, `item`). */
  group: string
}

/** A function of the expression language: its signature and an example, as the language writes them. */
export interface RuleFormulaFunction {
  name: string
  signature: string
  example: string
  /** What Insert puts in, and where the cursor goes inside it (an offset; absent = after it). */
  snippet: string
  caret?: number
}

/**
 * A ready-made formula. `{filter}` in it stands for one of the rule's filters, by its current name,
 * which the marketer picks; a recipe with it needs the rule to have a filter. `{current}` stands for
 * the formula the box already has (a cap wraps it); a recipe with it needs one written first.
 */
export interface RuleFormulaRecipe {
  key: string
  expect: RuleFormulaExpect
  formula: string
}

export interface RuleFormulaGuide {
  fields: RuleFormulaField[]
  functions: RuleFormulaFunction[]
  /** The operator chips, in order (`+`, `>=`, `and` …). */
  operators: string[]
  recipes: RuleFormulaRecipe[]
}

export const FORMULA_GUIDE: RuleFormulaGuide = {
  fields: [
    { path: 'session.subtotal', type: 'money', group: 'sale' },
    { path: 'session.total', type: 'money', group: 'sale' },
    { path: 'session.fees', type: 'money', group: 'sale' },
    { path: 'session.decimals', type: 'number', group: 'sale' },
    { path: 'session.channel', type: 'text', group: 'sale' },
    { path: 'session.store', type: 'text', group: 'sale' },
    { path: 'session.currency', type: 'text', group: 'sale' },
    { path: 'session.requestedPoints', type: 'number', group: 'sale' },
    { path: 'profile.loyaltyId', type: 'text', group: 'profile' },
    { path: 'profile.tier', type: 'text', group: 'profile' },
    { path: 'profile.points', type: 'number', group: 'profile' },
    { path: 'profile.tentativePoints', type: 'number', group: 'profile' },
    { path: 'item.net', type: 'money', group: 'item' },
    { path: 'item.lineNet', type: 'money', group: 'item' },
    { path: 'item.article', type: 'text', group: 'item' },
    { path: 'item.category', type: 'text', group: 'item' },
    { path: 'item.quantity', type: 'number', group: 'item' },
  ],
  functions: [
    { name: 'items', signature: "items('filter')", example: "items('Eligible')", snippet: "items('')", caret: 7 },
    { name: 'sum', signature: "sum(items('filter'), item.net)", example: "sum(items('Eligible'), item.net)", snippet: 'sum(, item.net)', caret: 4 },
    { name: 'count', signature: "count(items('filter'))", example: "count(items('Suncare')) >= 3", snippet: 'count()', caret: 6 },
    { name: 'round', signature: 'round(x, decimals, mode)', example: 'round(eligible * 0.1, 0, halfUp)', snippet: 'round(, 0, halfUp)', caret: 6 },
    { name: 'band', signature: 'band(x, from:rate, ...)', example: 'band(basis, 200:0.1, 400:0.12)', snippet: 'band(, 200:0.1, 400:0.12)', caret: 5 },
    { name: 'min', signature: 'min(a, b, ...)', example: 'min(back, 105)', snippet: 'min(, 100)', caret: 4 },
    { name: 'max', signature: 'max(a, b, ...)', example: 'max(back, 5)', snippet: 'max(, 5)', caret: 4 },
    { name: 'floor', signature: 'floor(x)', example: 'floor(basis / 10)', snippet: 'floor()', caret: 6 },
    { name: 'ceil', signature: 'ceil(x)', example: "ceil(count(items('Eligible')) / 2)", snippet: 'ceil()', caret: 5 },
    { name: 'if', signature: 'if(test, then, else)', example: "if(profile.tier == 'P', 0.15, 0.1)", snippet: 'if(, , )', caret: 3 },
  ],
  operators: ['+', '-', '*', '/', '(', ')', '>=', '>', '<=', '<', '==', '!=', 'and', 'or', 'not'],
  recipes: [
    { key: 'percentOfSpend', expect: 'number', formula: "round(sum(items('{filter}'), item.net) * 0.1, 0, halfUp)" },
    { key: 'tieredRate', expect: 'number', formula: "band(sum(items('{filter}'), item.net), 200:0.1, 400:0.12, 700:0.15)" },
    { key: 'capped', expect: 'number', formula: 'min({current}, 100)' },
    { key: 'pointsPerSar', expect: 'number', formula: "floor(sum(items('{filter}'), item.net) / 10)" },
    { key: 'topTiers', expect: 'number', formula: "if(profile.tier == 'P', 0.15, 0.1)" },
    { key: 'basketBigEnough', expect: 'bool', formula: 'session.total >= 150' },
    { key: 'enoughUnits', expect: 'bool', formula: "count(items('{filter}')) >= 3" },
    { key: 'goldOrPlatinum', expect: 'bool', formula: "profile.tier == 'G' or profile.tier == 'P'" },
    { key: 'enoughPoints', expect: 'bool', formula: 'profile.tentativePoints >= 30' },
    { key: 'tillOnly', expect: 'bool', formula: "session.channel == 'POS'" },
  ],
}
