import test from "node:test";
import assert from "node:assert/strict";
import {
  createPlannerSession,
  isDirty,
} from "../features/planner/planner-session.ts";
import { PLAN_LIMITS } from "../lib/plan.ts";
import { planSummary } from "../lib/plan-summary.ts";
import { demoPlan } from "../lib/plan-fixtures.ts";
import { schedule } from "../lib/plan-schedule.ts";
import { mergePlans } from "../lib/plan-merge.ts";
import { applyPlanCommand } from "../lib/plan-commands.ts";
import {
  loadedPlanSchema,
  savePlanSchema,
  savedPlanSchema,
} from "../lib/plan-contract.ts";
import { PlanRepositoryError } from "../lib/plan-contract.ts";

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
function fixture(overrides = {}) {
  let record = { plan: demoPlan(), revision: 1 };
  return createPlannerSession({
    async load() {
      return structuredClone(record);
    },
    async save({ plan, revision }) {
      if (revision !== record.revision) throw new Error("conflict");
      record = { plan: structuredClone(plan), revision: revision + 1 };
      return { revision: record.revision };
    },
    ...overrides,
  });
}

test("undo followed immediately by another input uses restored state and preserves time continuity", async () => {
  const session = fixture();
  await session.load("2026-09-11");
  session.execute({ type: "reorder", id: "shopping", target: 0 });
  session.undo();
  session.execute({ type: "complete", id: "study", done: true });
  const plan = session.getSnapshot().plan;
  assert.equal(plan.blocks[0].id, "study");
  assert.equal(plan.blocks[0].done, true);
  assert.deepEqual(
    schedule(plan).map((b) => [b.start, b.end]),
    [
      [540, 660],
      [660, 720],
      [720, 780],
      [780, 810],
    ]
  );
  assert.equal(isDirty(session.getSnapshot()), true);
  await session.save();
  assert.equal(isDirty(session.getSnapshot()), false);
  await session.load("2026-09-11");
  assert.deepEqual(session.getSnapshot().plan, plan);
});

test("failed save retains draft, revision, history and pending date; retry saves before navigation", async () => {
  const attempts = [];
  let fails = true;
  const session = fixture({
    async save(payload) {
      attempts.push(payload);
      if (fails) throw new Error("conflict");
      return { revision: 2 };
    },
  });
  await session.load("2026-09-11");
  session.execute({ type: "remove", id: "rest" });
  const draft = session.getSnapshot().plan;
  await session.requestDate("2026-09-12");
  assert.equal(session.getSnapshot().date, "2026-09-11");
  assert.equal(await session.resolveDate("save"), false);
  assert.deepEqual(session.getSnapshot().plan, draft);
  assert.equal(session.getSnapshot().revision, 1);
  assert.equal(session.getSnapshot().history.length, 1);
  assert.equal(session.getSnapshot().pendingDate, "2026-09-12");
  fails = false;
  await session.resolveDate("save");
  assert.equal(session.getSnapshot().date, "2026-09-12");
  assert.equal(session.getSnapshot().pendingDate, null);
  assert.equal(attempts[1].day, "2026-09-11");
  assert.deepEqual(attempts[1].plan, draft);
});

test("saving blocks duplicate saves, mutations, undo and date changes at the session interface", async () => {
  const pending = deferred();
  let calls = 0;
  const session = fixture({
    save() {
      calls++;
      return pending.promise;
    },
  });
  await session.load("2026-09-11");
  session.execute({ type: "start", minutes: 600 });
  const plan = session.getSnapshot().plan;
  const saving = session.save();
  assert.equal(await session.save(), false);
  assert.equal(session.execute({ type: "remove", id: "study" }), false);
  assert.equal(session.undo(), false);
  await session.requestDate("2026-09-12");
  assert.equal(await session.load("2026-09-13"), false);
  assert.deepEqual(session.getSnapshot().plan, plan);
  assert.equal(session.getSnapshot().date, "2026-09-11");
  pending.resolve({ revision: 2 });
  assert.equal(await saving, true);
  assert.equal(calls, 1);
});

test("late success and failure from an older load never replace the selected date or error", async () => {
  for (const fail of [false, true]) {
    const old = deferred();
    const latest = demoPlan();
    latest.start = 720;
    const session = fixture({
      load(day) {
        return day === "2026-09-11"
          ? old.promise
          : Promise.resolve({ plan: latest, revision: 7 });
      },
    });
    const first = session.load("2026-09-11");
    await session.load("2026-09-12");
    if (fail) old.reject(new Error("old request failed"));
    else old.resolve({ plan: demoPlan(), revision: 1 });
    await first;
    assert.equal(session.getSnapshot().plan.start, 720);
    assert.equal(session.getSnapshot().revision, 7);
    assert.equal(session.getSnapshot().date, "2026-09-12");
    assert.equal(session.getSnapshot().error, "");
  }
});

test("cancelled loads do not publish state and absent records stay clean examples", async () => {
  const pending = deferred();
  const session = fixture({ load: () => pending.promise });
  const loading = session.load("2026-09-11");
  session.cancelLoad();
  pending.resolve({ plan: null, revision: 0 });
  await loading;
  assert.equal(session.getSnapshot().status, "loading");
  await session.load("2026-09-11");
  assert.equal(session.getSnapshot().revision, 0);
  assert.equal(isDirty(session.getSnapshot()), false);
});

test("three-way merge keeps independent edits and rejects same-field conflicts", () => {
  const base = demoPlan();
  const local = structuredClone(base);
  local.blocks[0].title = "내가 바꾼 공부";
  const latest = structuredClone(base);
  latest.blocks[1].done = true;
  const merged = mergePlans(base, local, latest);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.plan.blocks[0].title, "내가 바꾼 공부");
  assert.equal(merged.plan.blocks[1].done, true);

  const changedLatest = structuredClone(base);
  changedLatest.blocks[0].title = "다른 창에서 바꾼 공부";
  const conflict = mergePlans(base, local, changedLatest);
  assert.equal(conflict.plan, null);
  assert.match(conflict.conflicts[0], /블록/);
});

test("conflict recovery reloads latest data and can reapply an independent draft", async () => {
  let record = { plan: demoPlan(), revision: 1 };
  let firstSave = true;
  const session = createPlannerSession({
    async load() {
      return structuredClone(record);
    },
    async save(payload) {
      if (firstSave) {
        firstSave = false;
        record = {
          plan: {
            ...record.plan,
            blocks: record.plan.blocks.map((block, index) =>
              index === 1 ? { ...block, done: true } : block
            ),
          },
          revision: 2,
        };
        throw new PlanRepositoryError("conflict", 409);
      }
      assert.equal(payload.revision, 2);
      record = { plan: structuredClone(payload.plan), revision: 3 };
      return { revision: 3 };
    },
  });
  await session.load("2026-09-11");
  session.execute({ type: "complete", id: "study", done: true });
  assert.equal(await session.save(), false);
  assert.equal(session.getSnapshot().conflict !== null, true);
  assert.equal(await session.resolveConflict("reapply"), true);
  assert.equal(
    session.getSnapshot().plan.blocks.find((block) => block.id === "study")
      .done,
    true
  );
  assert.equal(
    session.getSnapshot().plan.blocks.find((block) => block.id === "shopping")
      .done,
    true
  );
  assert.equal(isDirty(session.getSnapshot()), false);
});

test("unresolved conflicts block ordinary edits, undo, and saves", async () => {
  const session = createPlannerSession({
    async load() {
      return { plan: demoPlan(), revision: 1 };
    },
    async save() {
      throw new PlanRepositoryError("conflict", 409);
    },
  });
  await session.load("2026-09-11");
  session.execute({ type: "complete", id: "study", done: true });
  assert.equal(await session.save(), false);
  assert.equal(session.getSnapshot().status, "conflict");
  const conflictedPlan = structuredClone(session.getSnapshot().plan);
  assert.equal(
    session.execute({ type: "complete", id: "shopping", done: true }),
    false
  );
  assert.equal(session.undo(), false);
  assert.equal(await session.save(), false);
  await session.requestDate("2026-09-12");
  assert.deepEqual(session.getSnapshot().plan, conflictedPlan);
  assert.equal(session.getSnapshot().date, "2026-09-11");
  assert.equal(session.getSnapshot().pendingDate, null);
  assert.equal(session.getSnapshot().conflict !== null, true);
});

test("no-op and invalid commands do not grow history; mementos are bounded", async () => {
  const session = fixture();
  await session.load("2026-09-11");
  assert.equal(
    session.execute({ type: "reorder", id: "study", target: 0 }),
    false
  );
  assert.equal(session.execute({ type: "start", minutes: -1 }), false);
  assert.equal(session.getSnapshot().history.length, 0);
  for (let i = 0; i < 40; i++)
    session.execute({ type: "start", minutes: 600 + i });
  assert.equal(session.getSnapshot().history.length, PLAN_LIMITS.history);
  const snapshot = structuredClone(session.getSnapshot().plan);
  assert.equal(
    session.execute({ type: "reorder", id: "missing", target: 0 }),
    false
  );
  assert.deepEqual(session.getSnapshot().plan, snapshot);
});

test("cancel and discard date choices preserve or clear history without saving", async () => {
  let saves = 0;
  const session = fixture({
    async save() {
      saves++;
      return { revision: 2 };
    },
  });
  await session.load("2026-09-11");
  session.execute({ type: "remove", id: "study" });
  await session.requestDate("2026-09-12");
  await session.resolveDate("cancel");
  assert.equal(session.getSnapshot().date, "2026-09-11");
  assert.equal(session.getSnapshot().history.length, 1);
  await session.requestDate("2026-09-12");
  await session.resolveDate("discard");
  assert.equal(session.getSnapshot().date, "2026-09-12");
  assert.equal(session.getSnapshot().history.length, 0);
  assert.equal(saves, 0);
});

test("commands validate aggregate limits; summary is derived from the same plan", () => {
  const plan = demoPlan();
  const changed = applyPlanCommand(plan, {
    type: "upsert",
    block: { ...plan.blocks[0], minutes: 60, title: "  study  " },
  });
  assert.equal(changed.blocks[0].title, "study");
  assert.equal(plan.blocks[0].minutes, 120);
  assert.deepEqual(planSummary(changed), {
    total: 210,
    complete: 0,
    byColor: { blue: 60, peach: 60, green: 60, yellow: 30 },
    end: 750,
  });
  assert.throws(() =>
    applyPlanCommand(plan, {
      type: "upsert",
      block: { ...plan.blocks[0], minutes: PLAN_LIMITS.maxBlockMinutes + 1 },
    })
  );
});

test("wire contracts reject malformed plans/revisions at the HTTP adapter seam", () => {
  assert.equal(
    loadedPlanSchema.safeParse({ plan: demoPlan(), revision: "1" }).success,
    false
  );
  assert.equal(savedPlanSchema.safeParse({ revision: 0 }).success, false);
  assert.equal(
    savePlanSchema.safeParse({
      day: "2026-02-30",
      plan: demoPlan(),
      revision: 1,
    }).success,
    false
  );
  assert.equal(
    savePlanSchema.safeParse({
      day: "2026-09-11",
      plan: demoPlan(),
      revision: 1,
      extra: true,
    }).success,
    false
  );
});
