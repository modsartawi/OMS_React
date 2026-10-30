// What a condition may ask of a fact, by the fact's type and cardinality (BackOffice spec 3271, stories 15+16, F8-F12; oms 693).
// Pure: no React, no http. In core because the guard and monitor editors both build on it.
//
// The client refuses what a type cannot answer and never converts: comparing money within a currency, and a quantity's
// UCUM ratios, are the engine's. An amount stays the string typed, so it never passes through a float.
import { factKey, type FhirCatalogRow, type FhirFactType } from './fhir-catalog'
import { FACT_COUNT_OPS, FACT_DATE_OPS, isFactMoney, isFactQuantity, type EligibilityCondition, type FactCondition, type FactOp, type GuardCondition } from './model'
import type { RegistryField } from './registry'
import { factKind, fieldOfPath } from './registry-facts'

export interface FactShape {
  type: FhirFactType
  cardinality: 'single' | 'list'
  /** The declared code system. */
  system: string | null
  unit: string | null
  /** False when neither the catalog nor the registry names the fact: the shape is read off the value. */
  known: boolean
}

/** A key reading a FHIR message: every `$eligibility` key is one (phase 1's keys are in the catalog too). */
const FHIR_PATH = /^\$(eligibility|claim|claimResponse|line\.claim|line\.claimResponse|previous\.claimResponse|previous\.line\.claimResponse)\./
export const isFhirPath = (path: string): boolean => FHIR_PATH.test(path)

/** Whether any block of these conditions reads a FHIR message, so the catalog is worth asking for. */
export const usesFhirFacts = (conditions: readonly GuardCondition[]): boolean =>
  conditions.some((c) => (c.check === 'group' ? usesFhirFacts(c.conditions) : c.check === 'eligibility' || (c.check === 'fact' && isFhirPath(c.path))))

/** The catalog row a key reads; `benefit[OPD].x` is the row `benefit[*].x`. */
export const rowOfPath = (rows: readonly FhirCatalogRow[], path: string): FhirCatalogRow | undefined => {
  // Oms 699: `$previous.<key>` is the same field on the answer before, so it reads as that field.
  const current = path.startsWith('$previous.') ? `$${path.slice('$previous.'.length)}` : path
  const general = current.replace(/\[[^\]]*\]/g, '[*]')
  return rows.find((r) => factKey(r) === current || factKey(r) === general)
}

export const shapeOfRow = (r: FhirCatalogRow): FactShape => ({ type: r.type, cardinality: r.cardinality, system: r.system, unit: r.unit, known: true })

/** A registry fact keeps its phase-1 reading: a number, or anything else by codes (a flag and a day included). */
export const shapeOfField = (f: RegistryField): FactShape => ({ type: factKind(f) === 'number' ? 'number' : 'text', cardinality: 'single', system: null, unit: f.unit || null, known: true })

function shapeOfValue(c: FactCondition): FactShape {
  const type: FhirFactType = isFactMoney(c.value)
    ? 'money'
    : isFactQuantity(c.value)
      ? 'quantity'
      : c.op === 'is'
        ? 'flag'
        : (FACT_DATE_OPS as readonly string[]).includes(c.op)
          ? 'date'
          : c.system
            ? 'code'
            : typeof c.value === 'number' && !(FACT_COUNT_OPS as readonly string[]).includes(c.op)
              ? 'number'
              : 'text'
  return { type, cardinality: (FACT_COUNT_OPS as readonly string[]).includes(c.op) ? 'list' : 'single', system: c.system ?? null, unit: null, known: false }
}

/** The catalog decides, then the registry, then the value itself. */
export function factShapeOf(c: FactCondition, catalog: readonly FhirCatalogRow[], fields: readonly RegistryField[]): FactShape {
  const row = rowOfPath(catalog, c.path)
  if (row) return shapeOfRow(row)
  const field = fieldOfPath(fields, c.path)
  return field ? shapeOfField(field) : shapeOfValue(c)
}

const COMPARES: readonly FhirFactType[] = ['number', 'money', 'quantity']

/** What a fact of this shape can answer. Only a list is counted; a list of amounts has no code for any of to match. */
export function operatorsFor(s: FactShape): FactOp[] {
  if (s.cardinality === 'list') return COMPARES.includes(s.type) ? [...FACT_COUNT_OPS] : ['anyOf', 'noneOf', ...FACT_COUNT_OPS]
  if (COMPARES.includes(s.type)) return ['atLeast', 'below']
  if (s.type === 'flag') return ['is']
  if (s.type === 'date') return [...FACT_DATE_OPS]
  return ['anyOf', 'noneOf']
}

type FactTest = Pick<FactCondition, 'op' | 'value' | 'system'>

/** A test on this fact as it starts. */
export function factTestFor(s: FactShape, op: FactOp = operatorsFor(s)[0]): FactTest {
  switch (op) {
    case 'atLeast':
    case 'below':
      if (s.type === 'money') return { op, value: { amount: '0', currency: s.unit && !currencyProblem(s.unit) ? s.unit : 'SAR' } }
      if (s.type === 'quantity') return { op, value: { value: '0', unit: s.unit ?? '' } }
      return { op, value: 0 }
    case 'anyOf':
    case 'noneOf':
      return s.system ? { op, value: [], system: s.system } : { op, value: [] }
    case 'is':
      return { op, value: true }
    case 'countAtLeast':
    case 'countBelow':
      return { op, value: 1 }
    default:
      return { op, value: '' }
  }
}

const FAMILIES: readonly (readonly FactOp[])[] = [['atLeast', 'below'], ['anyOf', 'noneOf'], FACT_COUNT_OPS, FACT_DATE_OPS]

/** The block on another operator: one of the same family keeps its value, any other starts afresh. */
export function withOp(c: FactCondition, op: FactOp, s: FactShape): FactCondition {
  if (FAMILIES.some((f) => f.includes(op) && f.includes(c.op))) return { ...c, op }
  const { system: _s, ...rest } = c
  void _s
  return { ...rest, ...factTestFor(s, op) }
}

/**
 * An eligibility block with one `is` or one test on a written day, as the `fact` the editor draws. The wire keeps it an
 * `eligibility` block (oms 674), and a `fact` goes back as the same block. Anything else stays as written: null.
 */
export function factOfEligibility(c: EligibilityCondition): FactCondition | null {
  const tests = (['is', 'anyOf', 'above', 'atLeast', 'under', 'atMost', 'unit', ...FACT_DATE_OPS] as const).filter((k) => c[k] !== undefined)
  if (tests.length !== 1) return null
  const op = tests[0]
  const base = { check: 'fact' as const, path: `$eligibility.${c.field}`, ...(c.not ? { not: true } : {}) }
  if (op === 'is') return { ...base, op, value: c.is === true }
  if (!(FACT_DATE_OPS as readonly string[]).includes(op)) return null
  const day = c[op as (typeof FACT_DATE_OPS)[number]]
  return typeof day === 'string' && /^(\d{4}-\d{2}-\d{2})?$/.test(day) ? { ...base, op: op as FactOp, value: day } : null
}

export type ValueProblem = 'empty' | 'shape' | 'decimals' | 'currency' | 'unit'

function decimalProblem(text: string): ValueProblem | null {
  if (!text.trim()) return 'empty'
  return /^\d+(\.\d+)?$/.test(text) ? null : 'shape'
}

/** F10: more than 3 decimals is refused at the field, never rounded. */
export function amountProblem(text: string): ValueProblem | null {
  return decimalProblem(text) ?? ((text.split('.')[1]?.length ?? 0) > 3 ? 'decimals' : null)
}
export const quantityProblem = decimalProblem
export const currencyProblem = (text: string): ValueProblem | null => (/^[A-Z]{3}$/.test(text) ? null : 'currency')
export const unitProblem = (text: string): ValueProblem | null => (text.trim() ? null : 'unit')
