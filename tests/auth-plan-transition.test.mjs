import test from "node:test";
import assert from "node:assert/strict";
import { demoPlan } from "../lib/plan-fixtures.ts";
import { PlanRepositoryError } from "../lib/plan-contract.ts";
import { createPlannerSession } from "../features/planner/planner-session.ts";

function memoryDrafts() {
  const plans = new Map();
  return {
    plans,
    read(day) {
      return plans.get(day) ?? null;
    },
    write(day, plan) {
      plans.set(day, structuredClone(plan));
    },
    remove(day) {
      plans.delete(day);
    },
  };
}

function localBlock(title = "내 초안") {
  return { ...demoPlan().blocks[0], id: "local", title };
}

test("authentication keeps a local draft when the account has no plan", async () => {
  let authenticated = false;
  const drafts = memoryDrafts();
  const saves = [];
  const session = createPlannerSession(
    {
      async load() {
        if (!authenticated)
          throw new PlanRepositoryError("로그인 세션이 필요합니다.", 401);
        return { plan: null, revision: 0 };
      },
      async save(payload) {
        saves.push(payload);
        return { revision: 1 };
      },
    },
    "2026-09-17",
    { draftStore: drafts }
  );

  await session.load("2026-09-17");
  session.execute({ type: "upsert", block: localBlock() });
  authenticated = true;

  assert.equal(await session.reconcileAuthenticatedUser(), true);
  assert.equal(session.getSnapshot().status, "ready");
  assert.equal(session.getSnapshot().authRequired, false);
  assert.equal(session.getSnapshot().revision, 0);
  assert.equal(session.getSnapshot().plan.blocks[0].title, "내 초안");

  assert.equal(await session.save(), true);
  assert.equal(saves[0].plan.blocks[0].title, "내 초안");
  assert.equal(drafts.plans.has("2026-09-17"), false);
});

test("authentication pauses when an account plan would conflict with a local draft", async () => {
  let authenticated = false;
  const accountPlan = demoPlan();
  accountPlan.blocks[0].title = "계정에 저장된 계획";
  const drafts = memoryDrafts();
  const session = createPlannerSession(
    {
      async load() {
        if (!authenticated)
          throw new PlanRepositoryError("로그인 세션이 필요합니다.", 401);
        return { plan: structuredClone(accountPlan), revision: 3 };
      },
      async save() {
        return { revision: 4 };
      },
    },
    "2026-09-17",
    { draftStore: drafts }
  );

  await session.load("2026-09-17");
  session.execute({ type: "upsert", block: localBlock() });
  authenticated = true;

  assert.equal(await session.reconcileAuthenticatedUser(), true);
  const state = session.getSnapshot();
  assert.equal(state.status, "conflict");
  assert.equal(state.authRequired, false);
  assert.equal(state.revision, 3);
  assert.equal(state.conflict.latest.blocks[0].title, "계정에 저장된 계획");
  assert.match(state.error, /최신 내용과 내 변경/);
});

test("signing out never copies the visible account plan into local storage", async () => {
  const drafts = memoryDrafts();
  const session = createPlannerSession(
    {
      async load() {
        return { plan: demoPlan(), revision: 2 };
      },
      async save() {
        return { revision: 3 };
      },
    },
    "2026-09-17",
    { draftStore: drafts }
  );

  await session.load("2026-09-17");
  assert.equal(session.reconcileSignedOutUser(), true);
  const state = session.getSnapshot();
  assert.equal(state.authRequired, true);
  assert.equal(state.plan.blocks.length, 0);
  assert.equal(state.plan.start, null);
  assert.equal(drafts.plans.has("2026-09-17"), false);
});

test("switching accounts clears the previous plan before loading the new account", async () => {
  let accountPlan = demoPlan();
  accountPlan.blocks[0].title = "계정 A 계획";
  const nextAccountPlan = demoPlan();
  nextAccountPlan.blocks[0].title = "계정 B 계획";
  const session = createPlannerSession(
    {
      async load() {
        return { plan: structuredClone(accountPlan), revision: 1 };
      },
      async save() {
        return { revision: 2 };
      },
    },
    "2026-09-17"
  );

  await session.load("2026-09-17");
  accountPlan = nextAccountPlan;
  assert.equal(await session.reloadAuthenticatedUser(), true);

  const state = session.getSnapshot();
  assert.equal(state.status, "ready");
  assert.equal(state.plan.blocks[0].title, "계정 B 계획");
  assert.notEqual(state.plan.blocks[0].title, "계정 A 계획");
});
