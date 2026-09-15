import { moveBlock, planSchema, type Block, type Plan } from "./plan.ts";

export type PlanCommand =
  | { type: "reorder"; id: string; target: number }
  | { type: "upsert"; block: Block }
  | { type: "remove"; id: string }
  | { type: "complete"; id: string; done: boolean }
  | { type: "start"; minutes: number | null };

// Every input adapter enters through this validation point.
export function applyPlanCommand(plan: Plan, command: PlanCommand): Plan {
  let next: Plan;
  switch (command.type) {
    case "reorder":
      next = moveBlock(plan, command.id, command.target);
      break;
    case "upsert":
      next = {
        ...plan,
        blocks: plan.blocks.some((b) => b.id === command.block.id)
          ? plan.blocks.map((b) =>
              b.id === command.block.id ? command.block : b
            )
          : [...plan.blocks, command.block],
      };
      break;
    case "remove":
      next = {
        ...plan,
        blocks: plan.blocks.filter((b) => b.id !== command.id),
      };
      break;
    case "complete":
      next = {
        ...plan,
        blocks: plan.blocks.map((b) =>
          b.id === command.id ? { ...b, done: command.done } : b
        ),
      };
      break;
    case "start":
      next = { ...plan, start: command.minutes };
      break;
  }
  return planSchema.parse(next);
}
