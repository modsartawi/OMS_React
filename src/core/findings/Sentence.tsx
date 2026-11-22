import { Fragment } from 'react'
import { Link } from 'react-router'
import type { CcPart, CcTarget } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'

/**
 * A server sentence in parts (oms 946, BackOffice spec 4165): the words as the server wrote them, in the asked language;
 * a part with a target is a link the caller builds (`hrefOf`, from `@/core/command-center-routes`). The client parses
 * no words and translates nothing.
 *
 * Bidi (`.claude/rules/bidi.md`): the sentence is free text in either script, so it is one `<bdi>` (dir auto); inside
 * it a pharmacy code is a machine value (`Ltr`) and a category name free text (`<bdi>`).
 *
 * In core because the command center's brief and profiles (946-949) and the copilot (950) all draw server sentences.
 */
export default function Sentence({ parts, hrefOf }: { parts: readonly CcPart[]; hrefOf: (target: CcTarget) => string }) {
  return (
    <bdi>
      {parts.map((part, i) =>
        part.target ? (
          <Link
            key={i}
            to={hrefOf(part.target)}
            className="font-medium text-primary underline-offset-2 hover:underline"
            data-cc-target={part.target.kind}
          >
            {part.target.kind === 'store' ? <Ltr>{part.text}</Ltr> : <bdi>{part.text}</bdi>}
          </Link>
        ) : (
          <Fragment key={i}>{part.text}</Fragment>
        ),
      )}
    </bdi>
  )
}
