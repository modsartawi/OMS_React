/**
 * oms 951 (BackOffice spec 4182 §A, §D): an article's Markdown renders with no raw HTML; a `screen:` link becomes an
 * "Open this screen" button and a `help:` link a link inside the help, both navigating in the app; an image loads from
 * the help image route in the app's language; headings carry anchors a `help:slug#anchor` link lands on.
 */
import { createElement } from 'react'
import { describe, expect, it } from 'vitest'
import HelpMarkdown from './HelpMarkdown'
import { drawHelp } from './test-render'

const draw = (markdown: string, lang: 'en' | 'ar' = 'en') => drawHelp(createElement(HelpMarkdown, { area: 'analytics', markdown, lang }))

describe('HelpMarkdown', () => {
  it('a screen: link is an "Open this screen" button for that route', () => {
    const html = draw('Open [My boards](screen:/analytics/boards) to start.')
    expect(html).toMatch(/<button[^>]*data-help-screen="\/analytics\/boards"[^>]*>[\s\S]*Open this screen[\s\S]*<\/button>/)
    expect(html).not.toContain('href="screen:')
    expect(draw('[x](screen:/analytics)', 'ar')).toContain('افتح هذه الشاشة')
  })

  it('a help: link is a link to the other article, at its heading', () => {
    const html = draw('See [sharing](help:boards#share).')
    expect(html).toMatch(/<a[^>]*href="\/analytics\/help\/boards#share"[^>]*>sharing<\/a>/)
    expect(html).not.toContain('href="help:')
  })

  it('renders no raw HTML: tags and handlers stay inert text', () => {
    const html = draw('Hello <script>alert(1)</script> and <img src="x" onerror="alert(2)"> and <b>bold</b>.\n\n<div onclick="x()">block</div>')
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/<img[^>]*src="x"/)
    expect(html).not.toMatch(/<b>/)
    expect(html).not.toMatch(/<div[^>]*onclick/i)
    expect(html).toContain('&lt;script&gt;')
  })

  it('a javascript: link never becomes an href', () => {
    expect(draw('[x](javascript:alert(1))')).not.toMatch(/href="javascript:/i)
  })

  it('an image loads its file for the help language from the help image route; another host never loads', () => {
    expect(draw('![The board editor](images/boards-editor.en.png)', 'ar')).toMatch(/data-help-image="boards-editor\.ar\.png"/)
    expect(draw('![The board editor](images/boards-editor.en.png)', 'en')).toMatch(/data-help-image="boards-editor\.en\.png"/)
    const outside = draw('![x](https://example.com/a.png)')
    expect(outside).not.toContain('example.com')
    expect(outside).not.toMatch(/<img/)
  })

  it('headings carry anchors, Arabic ones too; code reads left to right', () => {
    const html = draw('## Share a board\n\n## مشاركة لوحة\n\nRun `SELECT 1` now.\n\n```\nSELECT 2\n```')
    expect(html).toContain('id="share-a-board"')
    expect(html).toContain('id="مشاركة-لوحة"')
    expect(html).toMatch(/<bdi dir="ltr"><code[^>]*>SELECT 1<\/code><\/bdi>/)
    expect(html).toMatch(/<pre[^>]*dir="ltr"/)
  })
})
