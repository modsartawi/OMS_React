/** Review 4182 #2: a table of contents or an article missing a list or a line is read with an empty one, once, here. */
import { describe, expect, it } from 'vitest'
import { helpArticleOf, helpContentsOf } from './help-api'

describe('reading the help wire answer', () => {
  it('an article missing questions, screens or checkedAgainst reads them empty', () => {
    const contents = helpContentsOf({ draft: true, articles: [{ slug: 'start', title: 'Start', order: 1, access: 'viewer' }] } as never)
    expect(contents).toEqual({
      draft: true,
      articles: [{ slug: 'start', title: 'Start', order: 1, access: 'viewer', questions: [], screens: [], checkedAgainst: '' }],
    })
  })

  it('a contents with no articles or no draft flag reads as none and not draft', () => {
    expect(helpContentsOf({} as never)).toEqual({ draft: false, articles: [] })
  })

  it('an article keeps what it sent and fills what it did not', () => {
    const a = helpArticleOf({ slug: 'boards', title: 'Boards', order: 2, access: 'author', questions: ['How?'], markdown: '# Boards' } as never)
    expect(a).toEqual({ slug: 'boards', title: 'Boards', order: 2, access: 'author', questions: ['How?'], screens: [], checkedAgainst: '', markdown: '# Boards' })
    expect(helpArticleOf({ slug: 'x' } as never).markdown).toBe('')
  })
})
