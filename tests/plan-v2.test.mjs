import test from "node:test";
import assert from "node:assert/strict";
import {
  planSchema,
  decodePlan,
  persistedPlanSchema,
  STORAGE_SCHEMA_VERSION,
  planSummary,
} from "../lib/plan.ts";
import { schedule } from "../lib/plan-schedule.ts";

test("v1 plans decode into v2 without inventing user choices", () => {
  const legacy = {
    start: 540,
    blocks: [
      {
        id: "legacy",
        title: "기존 계획",
        minutes: 30,
        color: "blue",
        done: false,
      },
    ],
  };
  const decoded = decodePlan(legacy);
  assert.equal(decoded.schemaVersion, STORAGE_SCHEMA_VERSION);
  assert.equal(decoded.blocks[0].startMinute, null);
  assert.equal(decoded.blocks[0].minutes, 30);
  assert.equal(decoded.blocks[0].color, "blue");
  assert.equal(persistedPlanSchema.safeParse(legacy).success, false);
  assert.equal(persistedPlanSchema.safeParse(decoded).success, true);
});

test("optional time combinations project without storing the display slot", () => {
  const base = { schemaVersion: 2, start: null, blocks: [] };
  const combinations = [
    { id: "none", startMinute: null, minutes: null },
    { id: "start", startMinute: 780, minutes: null },
    { id: "duration", startMinute: null, minutes: 15 },
    { id: "both", startMinute: 820, minutes: 15 },
  ];
  const plan = planSchema.parse({
    ...base,
    blocks: combinations.map((block) => ({
      ...block,
      title: block.id,
      color: null,
      done: false,
    })),
  });
  const rows = schedule(plan);
  assert.equal(rows[0].usesSlot, true);
  assert.equal(rows[0].resolvedStart, null);
  assert.equal(rows[1].resolvedStart, 780);
  assert.equal(rows[1].resolvedEnd, null);
  assert.equal(rows[2].resolvedStart, null);
  assert.equal(rows[2].slotMinutes, 15);
  assert.equal(rows[3].resolvedStart, 820);
  assert.equal(rows[3].resolvedEnd, 835);
  assert.equal(plan.blocks[0].minutes, null);
  assert.equal(planSummary(plan).total, 30);
});

test("explicit anchors start a local flow without moving the saved values", () => {
  const plan = planSchema.parse({
    schemaVersion: 2,
    start: null,
    blocks: [
      {
        id: "anchor",
        title: "기준",
        startMinute: 780,
        minutes: 20,
        color: null,
        done: false,
      },
      {
        id: "flow",
        title: "이어지는 항목",
        startMinute: null,
        minutes: null,
        color: null,
        done: false,
      },
      {
        id: "overlap",
        title: "겹치는 기준",
        startMinute: 790,
        minutes: 10,
        color: null,
        done: false,
      },
    ],
  });
  const rows = schedule(plan);
  assert.deepEqual(
    rows.map((row) => [row.start, row.end, row.resolvedStart, row.layoutMode]),
    [
      [780, 800, 780, "order"],
      [800, 830, null, "order"],
      [790, 800, 790, "order"],
    ]
  );
});
