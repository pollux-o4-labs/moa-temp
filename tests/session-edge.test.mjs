import test from "node:test";
import assert from "node:assert/strict";
import { ZodError } from "zod";
import { createPlannerSession } from "../features/planner/planner-session.ts";
import { demoPlan } from "../lib/plan-fixtures.ts";
import { PlanRepositoryError } from "../lib/plan-contract.ts";

function repository(overrides = {}) {
  return {
    async load() {
      return { plan: demoPlan(), revision: 1 };
    },
    async save() {
      return { revision: 2 };
    },
    ...overrides,
  };
}

test("session rejects invalid dates and exposes unavailable load failures", async () => {
  const invalid = createPlannerSession(repository());
  assert.equal(await invalid.load("2026-02-30"), false);
  assert.equal(invalid.getSnapshot().error, "날짜를 확인해주세요.");

  const unavailable = createPlannerSession(
    repository({
      async load() {
        throw new Error("서버에 연결할 수 없어요.");
      },
    })
  );
  assert.equal(await unavailable.load("2026-09-14"), false);
  assert.equal(unavailable.getSnapshot().status, "unavailable");
  assert.equal(unavailable.getSnapshot().error, "서버에 연결할 수 없어요.");
});

test("session maps schema and unknown failures to safe messages", async () => {
  const schemaFailure = createPlannerSession(
    repository({
      async load() {
        throw new ZodError([
          { code: "custom", message: "형식 오류", path: [] },
        ]);
      },
    })
  );
  await schemaFailure.load("2026-09-14");
  assert.equal(schemaFailure.getSnapshot().error, "형식 오류");

  const unknownFailure = createPlannerSession(
    repository({
      async load() {
        throw { unexpected: true };
      },
    })
  );
  await unknownFailure.load("2026-09-14");
  assert.equal(unknownFailure.getSnapshot().error, "요청을 처리하지 못했어요.");
});

test("session navigates clean dates and protects no-op resolution choices", async () => {
  const loadedDays = [];
  const session = createPlannerSession(
    repository({
      async load(day) {
        loadedDays.push(day);
        return { plan: demoPlan(), revision: 1 };
      },
    })
  );
  await session.load("2026-09-14");
  await session.requestDate("2026-09-14");
  await session.requestDate("not-a-date");
  assert.equal(session.getSnapshot().error, "날짜를 확인해주세요.");
  await session.requestDate("2026-09-15");
  assert.deepEqual(loadedDays, ["2026-09-14", "2026-09-15"]);
  assert.equal(await session.resolveDate("cancel"), false);
  assert.equal(await session.resolveConflict("reload"), false);
});

test("conflict recovery can reload latest data or retain a merge error", async () => {
  let mode = "conflict";
  const latest = demoPlan();
  latest.blocks[0].done = true;
  const session = createPlannerSession(
    repository({
      async load() {
        return { plan: latest, revision: 2 };
      },
      async save() {
        if (mode === "conflict") throw new PlanRepositoryError("conflict", 409);
        return { revision: 3 };
      },
    })
  );
  await session.load("2026-09-14");
  session.execute({ type: "complete", id: "study", done: true });
  assert.equal(await session.save(), false);
  assert.equal(await session.resolveConflict("reload"), true);
  assert.equal(session.getSnapshot().plan.blocks[0].done, true);

  mode = "conflict";
  session.execute({ type: "complete", id: "study", done: false });
  assert.equal(await session.save(), false);
  const conflictLatest = demoPlan();
  conflictLatest.blocks[0].title = "서버 제목";
  let reapplyLoads = 0;
  const reapply = createPlannerSession(
    repository({
      async load() {
        reapplyLoads++;
        return reapplyLoads === 1
          ? { plan: demoPlan(), revision: 1 }
          : { plan: conflictLatest, revision: 2 };
      },
      async save() {
        throw new PlanRepositoryError("conflict", 409);
      },
    })
  );
  await reapply.load("2026-09-14");
  reapply.execute({
    type: "upsert",
    block: { ...demoPlan().blocks[0], title: "로컬 제목" },
  });
  assert.equal(await reapply.save(), false);
  assert.equal(await reapply.resolveConflict("reapply"), false);
  assert.equal(reapply.getSnapshot().status, "conflict");
  assert.match(reapply.getSnapshot().error, /자동 병합할 수 없어요/);
});

test("conflict recovery reports a latest-load failure and retains conflict state", async () => {
  let loadCalls = 0;
  const session = createPlannerSession(
    repository({
      async load() {
        loadCalls++;
        if (loadCalls > 1) throw new Error("최신 계획을 불러오지 못했어요.");
        return { plan: demoPlan(), revision: 1 };
      },
      async save() {
        throw new PlanRepositoryError("conflict", 409);
      },
    })
  );
  await session.load("2026-01-02");
  session.execute({
    type: "upsert",
    block: { ...demoPlan().blocks[0], title: "로컬 변경" },
  });
  assert.equal(await session.save(), false);
  assert.equal(await session.resolveConflict("reload"), false);
  assert.equal(session.getSnapshot().status, "conflict");
  assert.equal(session.getSnapshot().error, "최신 계획을 불러오지 못했어요.");
});

test("session subscribers can unsubscribe without receiving later state changes", async () => {
  const session = createPlannerSession(repository());
  let calls = 0;
  const unsubscribe = session.subscribe(() => {
    calls++;
  });
  await session.load("2026-09-14");
  assert.ok(calls > 0);
  const before = calls;
  unsubscribe();
  session.execute({ type: "start", minutes: 600 });
  assert.equal(calls, before);
});
