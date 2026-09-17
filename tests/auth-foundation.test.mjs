import test from "node:test";
import assert from "node:assert/strict";
import { createDraftBlock, emptyPlan } from "../lib/plan.ts";
import { PlanRepositoryError } from "../lib/plan-contract.ts";
import { createPlannerSession } from "../features/planner/planner-session.ts";
import { createStaticPlanRepository } from "../features/planner/static-plan-repository.ts";
import {
  ANONYMOUS_DRAFT_KEY_PREFIX,
  createLocalDraftStore,
} from "../features/planner/local-draft.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

test("anonymous draft storage is day-scoped and rejects malformed data", () => {
  const storage = memoryStorage();
  const drafts = createLocalDraftStore(storage);
  const plan = emptyPlan();
  plan.blocks = [createDraftBlock("draft", "초안")];

  drafts.write("2026-09-15", plan);
  assert.deepEqual(drafts.read("2026-09-15"), plan);
  assert.equal(drafts.read("2026-09-16"), null);
  assert.equal(
    storage.values.has(`${ANONYMOUS_DRAFT_KEY_PREFIX}2026-09-15`),
    true
  );

  storage.values.set(
    `${ANONYMOUS_DRAFT_KEY_PREFIX}2026-09-16`,
    JSON.stringify({ blocks: "not-a-plan" })
  );
  assert.equal(drafts.read("2026-09-16"), null);
});

test("401 load enters an anonymous draft session without calling it server data", async () => {
  const storage = memoryStorage();
  const drafts = createLocalDraftStore(storage);
  const plan = emptyPlan();
  plan.blocks = [createDraftBlock("draft", "이미 적어둔 초안")];
  drafts.write("2026-09-15", plan);
  const saves = [];

  const session = createPlannerSession(
    {
      async load() {
        throw new PlanRepositoryError("로그인이 필요합니다.", 401);
      },
      async save(payload) {
        saves.push(payload);
        throw new PlanRepositoryError("로그인이 필요합니다.", 401);
      },
    },
    "",
    { draftStore: drafts }
  );

  assert.equal(await session.load("2026-09-15"), true);
  assert.equal(session.getSnapshot().status, "ready");
  assert.equal(session.getSnapshot().authRequired, true);
  assert.deepEqual(session.getSnapshot().plan, plan);
  assert.equal(session.getSnapshot().revision, 0);

  session.execute({ type: "upsert", block: createDraftBlock("new", "추가") });
  assert.equal(drafts.read("2026-09-15").blocks.length, 2);
  assert.equal(await session.save(), false);
  assert.equal(saves.length, 1);
  assert.equal(session.getSnapshot().authRequired, true);
  assert.equal(session.getSnapshot().errorStatus, 401);
  assert.equal(session.getSnapshot().status, "ready");
  assert.equal(session.getSnapshot().plan.blocks.length, 2);
});

test("successful save clears the local draft after authentication", async () => {
  const storage = memoryStorage();
  const drafts = createLocalDraftStore(storage);
  const session = createPlannerSession(
    {
      async load() {
        throw new PlanRepositoryError("로그인이 필요합니다.", 401);
      },
      async save() {
        return { revision: 1 };
      },
    },
    "",
    { draftStore: drafts }
  );

  await session.load("2026-09-15");
  session.execute({
    type: "upsert",
    block: createDraftBlock("draft", "저장할 계획"),
  });
  assert.notEqual(drafts.read("2026-09-15"), null);

  assert.equal(await session.save(), true);
  assert.equal(drafts.read("2026-09-15"), null);
  assert.equal(session.getSnapshot().authRequired, false);
});

test("static repository maps only static-host failures to authentication", async () => {
  const staticRepository = createStaticPlanRepository({
    async load() {
      throw new PlanRepositoryError("not found", 404);
    },
    async save() {
      throw new PlanRepositoryError("server failure", 502);
    },
  });

  await assert.rejects(
    staticRepository.load("2026-09-15"),
    (error) => error instanceof PlanRepositoryError && error.status === 401
  );
  await assert.rejects(
    staticRepository.save({
      day: "2026-09-15",
      plan: emptyPlan(),
      revision: 0,
    }),
    (error) => error instanceof PlanRepositoryError && error.status === 502
  );
});
