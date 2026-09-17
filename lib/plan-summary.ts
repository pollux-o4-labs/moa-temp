import { COLORS, type Plan } from "./plan.ts";

export function planSummary(plan: Plan) {
  const byColor = Object.fromEntries(
    COLORS.map((color) => [color, 0])
  ) as Record<(typeof COLORS)[number], number>;
  let total = 0;
  let complete = 0;
  for (const block of plan.blocks) {
    if (block.minutes !== null) total += block.minutes;
    if (block.done) complete += 1;
    if (block.color && block.minutes !== null)
      byColor[block.color] += block.minutes;
  }
  return {
    total,
    complete,
    byColor,
    end: plan.start === null ? null : plan.start + total,
  };
}
