import test from "node:test";
import assert from "node:assert/strict";
import { createAuthenticatedPlanRepository } from "../features/planner/browser-plan-repository.ts";

function stubRepository(name) {
  return {
    async load() {
      return { plan: null, revision: name === "firebase" ? 1 : 0, name };
    },
    async save() {
      return { revision: name === "firebase" ? 2 : 1, name };
    },
  };
}

test("browser plan repository switches to Firebase when Auth has a current user", async () => {
  const auth = { currentUser: null };
  const selected = createAuthenticatedPlanRepository({
    auth,
    authenticated: stubRepository("firebase"),
    anonymous: stubRepository("anonymous"),
  });

  assert.equal((await selected.load("2026-09-17")).name, "anonymous");
  assert.equal((await selected.save({})).name, "anonymous");

  auth.currentUser = { uid: "user-1" };
  assert.equal((await selected.load("2026-09-17")).name, "firebase");
  assert.equal((await selected.save({})).name, "firebase");
});
