import { z } from "zod";
import type { Plan } from "@/lib/plan";
import { schedule } from "@/lib/plan-schedule";
import type { PlannerSession } from "./planner-session";

type Tool = {
  name: string;
  description: string;
  inputSchema: object;
  annotations: { readOnlyHint: boolean };
  execute(input: unknown): unknown;
};
type ModelContext = {
  registerTool(
    tool: Tool,
    options: { signal: AbortSignal }
  ): void | Promise<void>;
};
const reorderInput = z
  .object({ blockId: z.string(), position: z.number().int().nonnegative() })
  .strict();

function toolBlocks(plan: Plan) {
  return schedule(plan).map((row) => ({
    id: row.id,
    title: row.title,
    done: row.done,
    saved: {
      startMinute: row.startMinute,
      minutes: row.minutes,
      color: row.color,
    },
    display: {
      start: row.resolvedStart,
      end: row.resolvedEnd,
      slotMinutes: row.slotMinutes,
      usesSlot: row.usesSlot,
      layoutMode: row.layoutMode,
    },
  }));
}

export function registerPlannerTools(session: PlannerSession) {
  const context = (document as Document & { modelContext?: ModelContext })
    .modelContext;
  if (!context) return;
  const lifecycle = new AbortController();
  function readyPlan() {
    const state = session.getSnapshot();
    if (state.status !== "ready") throw new Error("Plan is not ready");
    return state.plan;
  }
  const tools: Tool[] = [
    {
      name: "read_daily_plan",
      description:
        "Read the daily plan with saved values separated from display-only time projection.",
      inputSchema: {
        type: "object",
        properties: {},
        additionalProperties: false,
      },
      annotations: { readOnlyHint: true },
      execute(input) {
        z.object({}).strict().parse(input);
        const plan = readyPlan();
        return {
          schemaVersion: plan.schemaVersion,
          start: plan.start,
          blocks: toolBlocks(plan),
        };
      },
    },
    {
      name: "stage_block_reorder",
      description:
        "Move an existing block to a zero-based position in the draft. The user saves with Save plan.",
      inputSchema: {
        type: "object",
        properties: {
          blockId: { type: "string" },
          position: { type: "integer", minimum: 0 },
        },
        required: ["blockId", "position"],
        additionalProperties: false,
      },
      annotations: { readOnlyHint: false },
      execute(input) {
        const { blockId, position } = reorderInput.parse(input);
        readyPlan();
        session.execute({ type: "reorder", id: blockId, target: position });
        if (session.getSnapshot().error)
          throw new Error(session.getSnapshot().error);
        return {
          saved: false,
          blocks: toolBlocks(session.getSnapshot().plan),
        };
      },
    },
  ];
  for (const tool of tools) {
    try {
      Promise.resolve(
        context.registerTool(tool, { signal: lifecycle.signal })
      ).catch(() => {});
    } catch {
      /* Optional capability: unsupported registration must not break the planner. */
    }
  }
  return () => lifecycle.abort();
}
