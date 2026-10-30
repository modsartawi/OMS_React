import type { PlaygroundKind } from './playground'

// The rule playground's EXAMPLE dataset (BackOffice spec 3243; oms 677 seeded it, 678 added the coverage `payer`). In
// `core` (graduated from the playground feature by 688) because "Open in playground" on the guard / coverage /
// category screens builds a new experiment with it, and a feature may not import another. The values are example DATA
// the user edits, not copy, so they are not translated. Pure.

/** One nphies request with one line of 120 days' supply. */
export const EXAMPLE_DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: null, pharmacist: null, attributes: {} },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: {} },
  lines: [{ line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, icd: ['E11'], price: 120.5, eCode: null, dCode: null, sfdaCode: null, idfPriority: null, attributes: {} }],
  history: [],
  reference: {},
  eligibility: {},
}

/** GUESS (691): the engine's CoveragePayer — per deductible group the payer's own percent and maximum. */
export const EXAMPLE_COVERAGE_PAYER = {
  deductibles: { G1: { percent: 20, max: 50 }, G2: { percent: 30, max: 100 }, G3: { percent: null, max: null } },
}

/** A fresh copy of the kind's example data (a coverage experiment's carries the `payer` block). */
export const exampleData = (kind: PlaygroundKind): Record<string, unknown> =>
  structuredClone(kind === 'coverage' ? { ...EXAMPLE_DATA, payer: EXAMPLE_COVERAGE_PAYER } : EXAMPLE_DATA)
