/**
 * The copilot's "How do I…?" row (oms 952, BackOffice spec 4182 §D, story 18): two or three of the sample how-to
 * questions the help's table of contents carries (each article's front-matter `questions`), read in the help language.
 * In core so the copilot reaches the table of contents without importing the help feature. The random source is
 * passed in, so a test picks a known set.
 */
import type { HelpContents } from '@/core/models/help'

/** How many questions the row offers at most. */
export const HOW_TO_COUNT = 3

/** Up to `count` different, non-blank questions drawn at random from the contents; none without contents. */
export function howToQuestions(contents: HelpContents | undefined, random: () => number, count = HOW_TO_COUNT): string[] {
  const pool: string[] = []
  for (const a of contents?.articles ?? []) {
    for (const q of Array.isArray(a.questions) ? a.questions : []) {
      const text = typeof q === 'string' ? q.trim() : ''
      if (text !== '' && !pool.includes(text)) pool.push(text)
    }
  }
  const picked: string[] = []
  while (picked.length < count && pool.length > 0) {
    const at = Math.min(pool.length - 1, Math.max(0, Math.floor(random() * pool.length)))
    picked.push(...pool.splice(at, 1))
  }
  return picked
}
