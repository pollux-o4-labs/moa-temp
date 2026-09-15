import test from "node:test";
import assert from "node:assert/strict";
import fc from "fast-check";
import { moveBlock, planSchema } from "../lib/plan.ts";
import { schedule } from "../lib/plan-schedule.ts";

const blockArbitrary = fc.record({
  id: fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/),
  title: fc.constant("generated task"),
  minutes: fc.integer({ min: 5, max: 120 }),
  color: fc.constantFrom("blue", "peach", "green", "yellow"),
  done: fc.boolean(),
});

const planArbitrary = fc
  .record({
    start: fc.integer({ min: 0, max: 1_439 }),
    blocks: fc.uniqueArray(blockArbitrary, {
      minLength: 1,
      maxLength: 12,
      selector: (block) => block.id,
    }),
  })
  .filter(
    (plan) =>
      plan.blocks.reduce((total, block) => total + block.minutes, 0) <= 1_440
  );

test("generated valid plans preserve order, identity and time continuity", () => {
  fc.assert(
    fc.property(planArbitrary, (plan) => {
      planSchema.parse(plan);
      const expectedIds = plan.blocks.map((block) => block.id).sort();

      for (const block of plan.blocks)
        for (let target = 0; target < plan.blocks.length; target++) {
          const moved = moveBlock(plan, block.id, target);
          const rows = schedule(moved);

          assert.deepEqual(
            moved.blocks.map((item) => item.id).sort(),
            expectedIds
          );
          assert.equal(moved.blocks[target].id, block.id);
          assert.equal(rows[0].start, plan.start);
          rows.forEach((row, index) => {
            assert.equal(row.end - row.start, row.minutes);
            if (index > 0) assert.equal(row.start, rows[index - 1].end);
          });
          planSchema.parse(moved);
        }
    }),
    { numRuns: 100 }
  );
});
