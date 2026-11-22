/**
 * Reading the help wire answers (BackOffice 4183/4184/4188, pricing2 @ 98f9a5ad9): the contents
 * `{ area, language, draft, articles, tours }`, the article `{ area, language, draft, article, markdown, sections }` with
 * its front matter nested — flattened here, once, into the client's `HelpArticle`. A missing list or line reads empty
 * (review 4182 #2); `access` is a list of levels, lowest first.
 */
import { describe, expect, it } from 'vitest'
import { helpArticleOf, helpContentsOf } from './help-api'

const info = { slug: 'home-library', title: 'Home and the library', order: 1, access: ['viewer', 'author'], screens: ['/analytics', '/analytics/library'], checkedAgainst: 'oms-react b4f6ba2a', questions: ['How do I find a board or a report?'] }

describe('reading the help contents', () => {
  it('the real wire shape: articles with an access list, and the tours with their steps', () => {
    const contents = helpContentsOf({
      area: 'analytics',
      language: 'en',
      draft: true,
      articles: [info],
      tours: [{ id: 'first-look', title: 'A first look around', access: ['viewer'], steps: [{ id: 'menu', target: 'analytics-menu', route: '/analytics', title: 'The menu', body: 'Every page.', ticksWhen: null }] }],
    } as never)
    expect(contents).toEqual({
      draft: true,
      articles: [info],
      tours: [{ id: 'first-look', title: 'A first look around', access: ['viewer'], steps: [{ id: 'menu', target: 'analytics-menu', route: '/analytics', title: 'The menu', body: 'Every page.', ticksWhen: null }] }],
    })
  })

  it('an article missing questions, screens, checkedAgainst or access reads them empty', () => {
    const contents = helpContentsOf({ draft: true, articles: [{ slug: 'start', title: 'Start', order: 1 }] } as never)
    expect(contents.articles).toEqual([{ slug: 'start', title: 'Start', order: 1, access: [], questions: [], screens: [], checkedAgainst: '' }])
  })

  it('access reads lowest first, once each, whatever order the front matter wrote', () => {
    // The real 09-copilot-admin.md writes `access: [curator, viewer]`.
    const contents = helpContentsOf({ draft: false, articles: [{ ...info, access: ['curator', 'viewer', 'curator'] }] } as never)
    expect(contents.articles[0].access).toEqual(['viewer', 'curator'])
    const unknownLast = helpContentsOf({ draft: false, articles: [{ ...info, access: ['owner', 'sql', 'viewer'] }] } as never)
    expect(unknownLast.articles[0].access).toEqual(['viewer', 'sql', 'owner'])
  })

  it('a contents with no articles, tours or draft flag reads as none and not draft', () => {
    expect(helpContentsOf({} as never)).toEqual({ draft: false, articles: [], tours: [] })
  })
})

describe('reading one article', () => {
  it('the real wire shape: the front matter nested under `article`, flattened beside the markdown and its sections', () => {
    const a = helpArticleOf({
      area: 'analytics',
      language: 'en',
      draft: true,
      article: info,
      markdown: '## Search {#search}\n\nType.',
      sections: [
        { anchor: '', heading: 'Home and the library', level: 1 },
        { anchor: 'search', heading: 'Search', level: 2 },
      ],
    } as never)
    expect(a).toEqual({
      ...info,
      markdown: '## Search {#search}\n\nType.',
      sections: [
        { anchor: '', heading: 'Home and the library', level: 1 },
        { anchor: 'search', heading: 'Search', level: 2 },
      ],
    })
  })

  it('an article with no body, no sections or no front matter fills what it did not send', () => {
    const a = helpArticleOf({ article: { slug: 'x' } } as never)
    expect(a).toEqual({ slug: 'x', title: '', order: 0, access: [], questions: [], screens: [], checkedAgainst: '', markdown: '', sections: [] })
    expect(helpArticleOf({} as never).sections).toEqual([])
  })
})
