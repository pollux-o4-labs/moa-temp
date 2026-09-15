import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { samePlan } from "../lib/plan.ts";
import { demoPlan } from "../lib/plan-fixtures.ts";
import { mergePlans } from "../lib/plan-merge.ts";

const planArbitrary = fc
  .record({
    start: fc.integer({ min: 0, max: 1_439 }),
    blocks: fc.uniqueArray(
      fc.record({
        id: fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/),
        title: fc.constant("task"),
        minutes: fc.integer({ min: 5, max: 120 }),
        color: fc.constantFrom("blue", "peach", "green", "yellow"),
        done: fc.boolean(),
      }),
      { minLength: 0, maxLength: 8, selector: (block) => block.id }
    ),
  })
  .filter(
    (plan) =>
      plan.blocks.reduce((total, block) => total + block.minutes, 0) <= 1_440
  );

function clone(plan) {
  return structuredClone(plan);
}

test("three-way merge is identity when all snapshots are equal", () => {
  fc.assert(
    fc.property(planArbitrary, (plan) => {
      const result = mergePlans(plan, plan, plan);
      assert.deepEqual(result.conflicts, []);
      assert.equal(samePlan(result.plan, plan), true);
    }),
    { numRuns: 100 }
  );
});

test("independent block edits are preserved across generated plans", () => {
  fc.assert(
    fc.property(
      planArbitrary.filter((plan) => plan.blocks.length >= 2),
      (base) => {
        const local = clone(base);
        const latest = clone(base);
        local.blocks[0].title = "local title";
        latest.blocks[1].done = !latest.blocks[1].done;
        const result = mergePlans(base, local, latest);
        assert.equal(result.conflicts.length, 0);
        assert.equal(result.plan.blocks[0].title, "local title");
        assert.equal(result.plan.blocks[1].done, latest.blocks[1].done);
      }
    ),
    { numRuns: 100 }
  );
});

test("merge handles equal edits, one-sided edits, additions and deletions", () => {
  const base = demoPlan();
  const local = clone(base);
  const latest = clone(base);
  local.blocks[0].title = "같은 변경";
  latest.blocks[0].title = "같은 변경";
  assert.equal(
    mergePlans(base, local, latest).plan.blocks[0].title,
    "같은 변경"
  );

  latest.blocks[1].done = true;
  assert.equal(mergePlans(base, base, latest).plan.blocks[1].done, true);
  local.blocks[1].done = true;
  assert.equal(mergePlans(base, local, base).plan.blocks[1].done, true);

  const localAdded = clone(base);
  localAdded.blocks.push({
    id: "local-new",
    title: "local new",
    minutes: 5,
    color: "blue",
    done: false,
  });
  assert.equal(
    mergePlans(base, localAdded, base).plan.blocks.some(
      (block) => block.id === "local-new"
    ),
    true
  );
  const latestAdded = clone(base);
  latestAdded.blocks.push({
    id: "latest-new",
    title: "latest new",
    minutes: 5,
    color: "green",
    done: false,
  });
  assert.equal(
    mergePlans(base, base, latestAdded).plan.blocks.some(
      (block) => block.id === "latest-new"
    ),
    true
  );

  const localDeleted = clone(base);
  localDeleted.blocks = localDeleted.blocks.filter(
    (block) => block.id !== "study"
  );
  const latestDeleted = clone(base);
  latestDeleted.blocks = latestDeleted.blocks.filter(
    (block) => block.id !== "study"
  );
  assert.equal(
    mergePlans(base, localDeleted, latestDeleted).plan.blocks.some(
      (block) => block.id === "study"
    ),
    false
  );
});

test("merge rejects competing block edits, additions and start times", () => {
  const base = demoPlan();
  const local = clone(base);
  const latest = clone(base);
  local.blocks[0].title = "local";
  latest.blocks[0].title = "latest";
  const blockConflict = mergePlans(base, local, latest);
  assert.equal(blockConflict.plan, null);
  assert.match(blockConflict.conflicts[0], /블록: local \(title\)/);

  const localAdded = clone(base);
  localAdded.blocks.push({
    id: "same-new",
    title: "local",
    minutes: 5,
    color: "blue",
    done: false,
  });
  const latestAdded = clone(base);
  latestAdded.blocks.push({
    id: "same-new",
    title: "latest",
    minutes: 5,
    color: "green",
    done: false,
  });
  assert.equal(mergePlans(base, localAdded, latestAdded).plan, null);

  const localStart = clone(base);
  const latestStart = clone(base);
  localStart.start = 600;
  latestStart.start = 660;
  assert.match(
    mergePlans(base, localStart, latestStart).conflicts[0],
    /하루 시작/
  );
  assert.equal(mergePlans(base, localStart, base).plan.start, 600);
  assert.equal(mergePlans(base, base, latestStart).plan.start, 660);
  const sameStart = clone(base);
  sameStart.start = 600;
  assert.equal(mergePlans(base, sameStart, sameStart).plan.start, 600);
});

test("merge combines independent fields on the same block", () => {
  const base = demoPlan();
  const local = structuredClone(base);
  const latest = structuredClone(base);
  local.blocks[0].title = "내 제목";
  latest.blocks[0].done = true;
  const result = mergePlans(base, local, latest);
  assert.deepEqual(result.conflicts, []);
  assert.equal(result.plan.blocks[0].title, "내 제목");
  assert.equal(result.plan.blocks[0].done, true);
});

test("merge chooses a single order change and rejects competing order changes", () => {
  const base = demoPlan();
  const local = clone(base);
  local.blocks.reverse();
  assert.deepEqual(
    mergePlans(base, local, base).plan.blocks.map((block) => block.id),
    local.blocks.map((block) => block.id)
  );
  const latest = clone(base);
  latest.blocks = [
    latest.blocks[1],
    latest.blocks[0],
    ...latest.blocks.slice(2),
  ];
  assert.deepEqual(
    mergePlans(base, base, latest).plan.blocks.map((block) => block.id),
    latest.blocks.map((block) => block.id)
  );
  assert.equal(mergePlans(base, local, latest).plan, null);
  assert.match(mergePlans(base, local, latest).conflicts.at(-1), /블록 순서/);
});

test("merge returns a validation conflict when independent edits exceed the day limit", () => {
  const base = {
    start: 0,
    blocks: [
      { id: "a", title: "a", minutes: 5, color: "blue", done: false },
      { id: "b", title: "b", minutes: 5, color: "green", done: false },
      { id: "c", title: "c", minutes: 5, color: "yellow", done: false },
    ],
  };
  const local = clone(base);
  local.blocks[0].minutes = 720;
  local.blocks[1].minutes = 720;
  const latest = clone(base);
  latest.blocks[2].minutes = 720;
  const result = mergePlans(base, local, latest);
  assert.equal(result.plan, null);
  assert.equal(
    result.conflicts[0],
    "계획한 시간은 최대 24시간까지 담을 수 있어요."
  );
});
