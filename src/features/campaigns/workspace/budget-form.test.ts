import { describe, expect, it } from 'vitest'
import type { RuleCampaignBudget } from '@/core/models/rule-campaign'
import { budgetForm, budgetProblem, budgetsWith, budgetsWithout, newBudgetForm, sameBudget, toBudget } from './budget-form'

const B = (id: string, value = 2): RuleCampaignBudget => ({ id, name: '', scope: 'profile', limit: 'uses', value, period: 'month' })

describe('the budget drawer’s form (ticket 510)', () => {
  it('a member or code budget starts as one use; the others as discount money', () => {
    expect(newBudgetForm('profile')).toEqual({ scope: 'profile', limit: 'uses', value: '1', period: 'lifetime', name: '' })
    expect(newBudgetForm('coupon').limit).toBe('uses')
    expect(newBudgetForm('campaign')).toEqual({ scope: 'campaign', limit: 'money', value: '10000', period: 'lifetime', name: '' })
    expect(newBudgetForm('store').limit).toBe('money')
  })

  it('the figure is required and above zero', () => {
    expect(budgetProblem({ limit: 'money', value: '' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'money', value: '  ' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'money', value: 'abc' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'money', value: '0' }, 'SAR')).toBe('notAboveZero')
    expect(budgetProblem({ limit: 'uses', value: '-1' }, 'SAR')).toBe('notAboveZero')
  })

  it('only a plain figure: no exponent, no hex', () => {
    expect(budgetProblem({ limit: 'uses', value: '2.5e-1' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'money', value: '1e-5' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'uses', value: '0x10' }, 'SAR')).toBe('valueRequired')
    expect(budgetProblem({ limit: 'money', value: '.5' }, 'SAR')).toBeNull()
    expect(budgetProblem({ limit: 'money', value: '12.' }, 'SAR')).toBeNull()
  })

  it('uses are whole', () => {
    expect(budgetProblem({ limit: 'uses', value: '1.5' }, 'SAR')).toBe('notWhole')
    expect(budgetProblem({ limit: 'uses', value: '2.0' }, 'SAR')).toBeNull()
    expect(budgetProblem({ limit: 'uses', value: '2' }, 'SAR')).toBeNull()
  })

  it('money takes the currency’s decimals: SAR two, BHD three, unknown three', () => {
    expect(budgetProblem({ limit: 'money', value: '10.25' }, 'SAR')).toBeNull()
    expect(budgetProblem({ limit: 'money', value: '10.255' }, 'SAR')).toBe('tooManyDecimals')
    expect(budgetProblem({ limit: 'pointsGiven', value: '10.255' }, 'BHD')).toBeNull()
    expect(budgetProblem({ limit: 'money', value: '10.2555' }, 'BHD')).toBe('tooManyDecimals')
    expect(budgetProblem({ limit: 'money', value: '10.250' }, 'SAR')).toBeNull()
    expect(budgetProblem({ limit: 'money', value: '10.255' }, null)).toBeNull()
  })

  it('a budget reads back into the form and out again, the name trimmed', () => {
    const b = { ...B('b1'), name: 'twice a month' }
    expect(toBudget(budgetForm(b), 'b1')).toEqual(b)
    expect(toBudget({ ...budgetForm(b), name: '  x  ', value: ' 3 ' }, 'b1')).toEqual({ ...b, name: 'x', value: 3 })
  })

  it('an edit that changes nothing is the same budget: the figure as a number, the name trimmed', () => {
    const f = budgetForm({ ...B('b1', 100), name: 'x' })
    expect(sameBudget({ ...f, value: '100.00' }, f)).toBe(true)
    expect(sameBudget({ ...f, name: ' x ' }, f)).toBe(true)
    expect(sameBudget({ ...f, value: '101' }, f)).toBe(false)
    expect(sameBudget({ ...f, period: 'day' }, f)).toBe(false)
  })

  it('a save replaces the budget with its id, or adds it at the end; a delete removes only it', () => {
    const list = [B('b1'), B('b2')]
    expect(budgetsWith(list, B('b2', 5)).map((b) => b.value)).toEqual([2, 5])
    expect(budgetsWith(list, B('b3')).map((b) => b.id)).toEqual(['b1', 'b2', 'b3'])
    expect(budgetsWithout(list, 'b1').map((b) => b.id)).toEqual(['b2'])
  })
})
