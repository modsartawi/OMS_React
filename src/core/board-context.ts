import type { CopilotBoardContext, CopilotBoardEdit } from '@/core/models/copilot'
import { createItemContext, type ItemContextState, type PostedEdit } from './item-context'

/**
 * The board-in-context bridge (ticket 836, BackOffice 3430): the board editor's twin of `./report-context`. The open
 * editor publishes `{ boardId, revision, draft }` (a saved board only: `edit_board` edits a board that exists), the
 * copilot sends it as the Ask body's `boardContext`, and an answer's `boardEdit` comes back here for the editor to take
 * once and apply as one undo step. It never saves it.
 */
export type PostedBoardEdit = PostedEdit<CopilotBoardEdit>

export type BoardContextState = ItemContextState<CopilotBoardContext, CopilotBoardEdit>

export function createBoardContext() {
  return createItemContext<CopilotBoardContext, CopilotBoardEdit>(
    (c) => c.boardId,
    (e) => e.boardId,
  )
}

export const useBoardContext = createBoardContext()
