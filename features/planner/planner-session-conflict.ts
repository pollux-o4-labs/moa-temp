import type { Plan } from "../../lib/plan.ts";
import { replaceBlockField, type BlockField } from "../../lib/block-fields.ts";
import type { ConflictState } from "./planner-session.ts";

export function applyConflictFieldChoice(
  conflict: ConflictState,
  blockId: string,
  field: BlockField,
  choice: "local" | "latest"
): { latest: Plan; draft: Plan } | null {
  if (!conflict.latest) return null;
  const detail = conflict.details.find(
    (item) => item.kind === "block" && item.id === blockId
  );
  if (!detail || detail.kind !== "block" || !detail.fields.includes(field))
    return null;
  const latest: Plan = {
    ...conflict.latest,
    blocks: conflict.latest.blocks.map((block) => {
      if (block.id !== blockId || choice === "latest") return block;
      const local = conflict.draft.blocks.find(
        (candidate) => candidate.id === blockId
      );
      return local ? replaceBlockField(block, local, field) : block;
    }),
  };
  const draft: Plan = {
    ...conflict.draft,
    blocks: conflict.draft.blocks.map((block) => {
      if (block.id !== blockId || choice === "local") return block;
      const latestBlock = conflict.latest?.blocks.find(
        (candidate) => candidate.id === blockId
      );
      return latestBlock ? replaceBlockField(block, latestBlock, field) : block;
    }),
  };
  return { latest, draft };
}
