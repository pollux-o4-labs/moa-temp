import type { Plan, Block } from "../../lib/plan.ts";
import type { BlockField } from "../../lib/plan-merge.ts";
import type { ConflictState } from "./planner-session.ts";

function replaceBlockField(target: Block, source: Block, field: BlockField) {
  if (field === "title") return { ...target, title: source.title };
  if (field === "startMinute")
    return { ...target, startMinute: source.startMinute };
  if (field === "minutes") return { ...target, minutes: source.minutes };
  if (field === "color") return { ...target, color: source.color };
  return { ...target, done: source.done };
}

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
