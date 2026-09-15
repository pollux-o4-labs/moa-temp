import {
  normalizePlanShape,
  planSchema,
  sameBlock,
  STORAGE_SCHEMA_VERSION,
  type Block,
  type Plan,
} from "./plan.ts";

export type MergeResult =
  | { plan: Plan; conflicts: []; details: [] }
  | {
      plan: null;
      conflicts: string[];
      details: MergeConflictDetail[];
    };

export type BlockField = "title" | "startMinute" | "minutes" | "color" | "done";
export type MergeConflictDetail =
  | {
      kind: "block";
      id: string;
      local: Block;
      latest: Block;
      fields: BlockField[];
    }
  | { kind: "order" }
  | { kind: "start" }
  | { kind: "validation"; message: string };

const BLOCK_FIELDS: BlockField[] = [
  "title",
  "startMinute",
  "minutes",
  "color",
  "done",
];

function mergeBlock(
  base: Block,
  local: Block,
  latest: Block
): { block: Block; conflicts: BlockField[] } {
  const conflicts = BLOCK_FIELDS.filter(
    (field) =>
      local[field] !== base[field] &&
      latest[field] !== base[field] &&
      local[field] !== latest[field]
  );
  if (conflicts.length) return { block: local, conflicts };
  const block: Block = {
    id: base.id,
    title: local.title === base.title ? latest.title : local.title,
    startMinute:
      local.startMinute === base.startMinute
        ? latest.startMinute
        : local.startMinute,
    minutes: local.minutes === base.minutes ? latest.minutes : local.minutes,
    color: local.color === base.color ? latest.color : local.color,
    done: local.done === base.done ? latest.done : local.done,
  };
  return { block, conflicts: [] };
}

// Three-way merge for independent edits made in separate planner windows.
// Conflicting edits are rejected instead of silently overwriting either user.
export function mergePlans(
  baseInput: Plan,
  localInput: Plan,
  latestInput: Plan
): MergeResult {
  const base = normalizePlanShape(baseInput);
  const local = normalizePlanShape(localInput);
  const latest = normalizePlanShape(latestInput);
  const conflicts: string[] = [];
  const details: MergeConflictDetail[] = [];
  const mergedById = new Map<string, Block>();
  const baseById = new Map(base.blocks.map((block) => [block.id, block]));
  const localById = new Map(local.blocks.map((block) => [block.id, block]));
  const latestById = new Map(latest.blocks.map((block) => [block.id, block]));
  const ids = new Set([
    ...baseById.keys(),
    ...localById.keys(),
    ...latestById.keys(),
  ]);

  for (const id of ids) {
    const fromBase = baseById.get(id);
    const fromLocal = localById.get(id);
    const fromLatest = latestById.get(id);
    if (sameBlock(fromLocal, fromLatest)) {
      if (fromLocal) mergedById.set(id, fromLocal);
    } else if (sameBlock(fromLocal, fromBase)) {
      if (fromLatest) mergedById.set(id, fromLatest);
    } else if (
      sameBlock(fromLatest, fromBase) ||
      sameBlock(fromLatest, fromLocal)
    ) {
      if (fromLocal) mergedById.set(id, fromLocal);
    } else if (fromBase && fromLocal && fromLatest) {
      const merged = mergeBlock(fromBase, fromLocal, fromLatest);
      if (merged.conflicts.length) {
        conflicts.push(
          `블록: ${fromLocal.title} (${merged.conflicts.join(", ")})`
        );
        details.push({
          kind: "block",
          id,
          local: fromLocal,
          latest: fromLatest,
          fields: merged.conflicts,
        });
      } else {
        mergedById.set(id, merged.block);
      }
    } else {
      conflicts.push(`블록: ${fromLocal?.title ?? fromLatest?.title ?? id}`);
      if (fromLocal && fromLatest)
        details.push({
          kind: "block",
          id,
          local: fromLocal,
          latest: fromLatest,
          fields: BLOCK_FIELDS,
        });
    }
  }

  const baseOrder = base.blocks.map((block) => block.id).join(",");
  const localOrder = local.blocks.map((block) => block.id).join(",");
  const latestOrder = latest.blocks.map((block) => block.id).join(",");
  let order: string[];
  if (localOrder === baseOrder || latestOrder === localOrder) {
    order = latest.blocks.map((block) => block.id);
  } else if (latestOrder === baseOrder) {
    order = local.blocks.map((block) => block.id);
  } else {
    conflicts.push("블록 순서");
    details.push({ kind: "order" });
    order = latest.blocks.map((block) => block.id);
  }

  if (
    local.start !== base.start &&
    latest.start !== base.start &&
    local.start !== latest.start
  ) {
    conflicts.push("하루 시작 시간");
    details.push({ kind: "start" });
  }
  const start =
    local.start === base.start || local.start === latest.start
      ? latest.start
      : local.start;
  if (conflicts.length) return { plan: null, conflicts, details };

  const blocks = order
    .map((id) => mergedById.get(id))
    .filter((block): block is Block => block !== undefined);
  const parsed = planSchema.safeParse({
    schemaVersion: STORAGE_SCHEMA_VERSION,
    start,
    blocks,
  });
  return parsed.success
    ? { plan: parsed.data, conflicts: [], details: [] }
    : {
        plan: null,
        conflicts: [parsed.error.issues[0]?.message ?? "계획"],
        details: [
          {
            kind: "validation",
            message: parsed.error.issues[0]?.message ?? "계획",
          },
        ],
      };
}
