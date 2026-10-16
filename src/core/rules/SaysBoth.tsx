import type { Says } from '@/core/models/rule-campaign'

/**
 * A text the marketer wrote in both languages — a campaign's name, a "not met" message, a label —
 * both shown wherever it is read: the English, then the Arabic right to left. Each is free text,
 * isolated on its own (`<bdi>`). Graduated at ticket 519, whose two support pages both draw it.
 */
export default function SaysBoth({ says }: { says: Says }) {
  return (
    <span className="flex flex-col" data-says="">
      <bdi lang="en" data-says-en="">
        {says.en}
      </bdi>
      <bdi dir="rtl" lang="ar" data-says-ar="">
        {says.ar}
      </bdi>
    </span>
  )
}
