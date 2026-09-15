import { CATEGORIES, type Block } from "@/lib/plan";
import { durationLabel, timeLabel } from "@/lib/plan-schedule";

type LabelMode = "basic" | "detailed";

function facts(block: Block, start: number | null, mode: LabelMode) {
  const details =
    mode === "detailed"
      ? [
          block.color ? CATEGORIES[block.color] : null,
          start === null ? null : timeLabel(start),
          block.minutes === null ? null : durationLabel(block.minutes),
        ]
      : [];
  return [...details, block.done ? "완료" : "미완료"].filter(
    (value): value is string => Boolean(value)
  );
}

export function blockAccessibleSummary(
  block: Block,
  start: number | null,
  mode: LabelMode = "detailed"
) {
  return [block.title, ...facts(block, start, mode)].join(", ");
}

export function blockActionLabel(
  block: Block,
  start: number | null,
  action: string,
  mode: LabelMode = "detailed"
) {
  return `${block.title} ${action}, ${facts(block, start, mode).join(", ")}`;
}
