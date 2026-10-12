import { beforeEach, describe, expect, it } from 'vitest'
import { useSession } from '@/core/session'
import { shownSource, useReplayDraft } from './replay-draft'

const SOURCE = { storeCode: 'P007', receiptNumber: '0042-0009-119000' }

describe('the replay draft (ticket 474)', () => {
  beforeEach(() => {
    useReplayDraft.setState({ text: '', source: null })
    useSession.setState({ userId: 'tester' })
  })

  it('starts empty, with no source', () => {
    expect(useReplayDraft.getState()).toMatchObject({ text: '', source: null })
  })

  it("holds the drawer's JSON and the receipt it came from", () => {
    useReplayDraft.getState().replace('{ "Header": {} }', SOURCE)
    expect(useReplayDraft.getState()).toMatchObject({ text: '{ "Header": {} }', source: SOURCE })
  })

  it('typing or pasting updates the text and keeps the source to compare', () => {
    useReplayDraft.getState().replace('{}', SOURCE)
    useReplayDraft.getState().edit('{ }')
    expect(useReplayDraft.getState()).toMatchObject({ text: '{ }', source: SOURCE })
  })

  it('the session ending empties it (a sign-out is no reload)', () => {
    useReplayDraft.getState().replace('{}', SOURCE)
    useSession.getState().clear()
    expect(useReplayDraft.getState()).toMatchObject({ text: '', source: null })
  })

  it('another user signing in empties it too', () => {
    useReplayDraft.getState().replace('{}', SOURCE)
    useSession.setState({ userId: 'someone-else' })
    expect(useReplayDraft.getState()).toMatchObject({ text: '', source: null })
  })

  it('the same user refreshing their session keeps it', () => {
    useReplayDraft.getState().replace('{}', SOURCE)
    useSession.getState().setSession({ userId: 'tester', currentStoreCode: 'P001' })
    expect(useReplayDraft.getState().source).toEqual(SOURCE)
  })
})

describe('shownSource', () => {
  it('names the source while the JSON is still that receipt', () => {
    expect(shownSource(SOURCE, '0042-0009-119000')).toEqual(SOURCE)
  })
  it('names nothing once the JSON is another receipt, unread, or there is no source', () => {
    expect(shownSource(SOURCE, 'FAKE-PASTED-1')).toBeNull()
    expect(shownSource(SOURCE, null)).toBeNull()
    expect(shownSource(SOURCE, undefined)).toBeNull()
    expect(shownSource(null, '0042-0009-119000')).toBeNull()
  })
})
