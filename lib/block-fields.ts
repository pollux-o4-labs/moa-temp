import type { Block } from "./plan.ts";

export const BLOCK_FIELDS = [
  "title",
  "startMinute",
  "minutes",
  "color",
  "done",
] as const;

export type BlockField = (typeof BLOCK_FIELDS)[number];

/** Replaces one user-editable field without exposing the block's other fields. */
export function replaceBlockField(
  target: Block,
  source: Block,
  field: BlockField
): Block {
  return { ...target, [field]: source[field] } as Block;
}
