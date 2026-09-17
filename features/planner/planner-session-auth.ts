import { emptyPlan, samePlan } from "../../lib/plan.ts";
import type { PlanRepository } from "../../lib/plan-contract.ts";
import type { LocalDraftStore } from "./local-draft.ts";
import type { PlannerState } from "./planner-session.ts";

type AuthReconciliationContext = {
  getState(): PlannerState;
  patch(update: Partial<PlannerState>): void;
  nextRequestId(): number;
  isCurrentRequest(id: number): boolean;
  fail(error: unknown): void;
  repository: PlanRepository;
  draftStore: LocalDraftStore;
};

export async function reconcileAuthenticatedUser(
  context: AuthReconciliationContext
) {
  const state = context.getState();
  if (!state.authRequired || state.status !== "ready") return false;

  const id = context.nextRequestId();
  const day = state.date;
  const draft = state.plan;
  const hasDraft = !samePlan(draft, emptyPlan());
  context.patch({
    status: "reconciling",
    error: "",
    errorScope: null,
    errorStatus: null,
  });

  try {
    const result = await context.repository.load(day);
    if (!context.isCurrentRequest(id)) return false;

    const latest = result.plan ?? emptyPlan();
    if (!hasDraft) {
      context.patch({
        plan: latest,
        revision: result.revision,
        saved: latest,
        history: [],
        status: "ready",
        conflict: null,
        authRequired: false,
        localDraftPending: false,
      });
      return true;
    }

    if (!result.plan) {
      context.patch({
        revision: result.revision,
        saved: latest,
        status: "ready",
        conflict: null,
        authRequired: false,
        localDraftPending: true,
      });
      return true;
    }

    context.patch({
      revision: result.revision,
      saved: latest,
      status: "conflict",
      authRequired: false,
      localDraftPending: true,
      conflict: {
        draft,
        base: emptyPlan(),
        latest,
        details: [],
      },
      error:
        "이 계정에 저장된 계획이 있어요. 최신 내용과 내 변경 중 선택해주세요.",
      errorScope: "request",
      errorStatus: 409,
    });
    return true;
  } catch (error) {
    if (!context.isCurrentRequest(id)) return false;
    context.fail(error);
    context.patch({ status: "ready" });
    return false;
  }
}

export async function reloadAuthenticatedUser(
  context: AuthReconciliationContext
) {
  const state = context.getState();
  if (state.status === "saving") return false;

  const id = context.nextRequestId();
  const blank = emptyPlan();
  context.patch({
    plan: blank,
    saved: blank,
    revision: 0,
    history: [],
    pendingDate: null,
    conflict: null,
    authRequired: false,
    localDraftPending: false,
    status: "loading",
    error: "",
    errorScope: null,
    errorStatus: null,
  });

  try {
    const result = await context.repository.load(state.date);
    if (!context.isCurrentRequest(id)) return false;
    const plan = result.plan ?? emptyPlan();
    context.patch({
      plan,
      saved: plan,
      revision: result.revision,
      history: [],
      status: "ready",
      authRequired: false,
      localDraftPending: false,
    });
    return true;
  } catch (error) {
    if (!context.isCurrentRequest(id)) return false;
    context.fail(error);
    context.patch({ status: "unavailable" });
    return false;
  }
}

export function reconcileSignedOutUser(context: AuthReconciliationContext) {
  const state = context.getState();
  if (state.status === "saving") return false;

  const draft = context.draftStore.read(state.date) ?? emptyPlan();
  context.nextRequestId();
  context.patch({
    plan: draft,
    saved: draft,
    revision: 0,
    history: [],
    pendingDate: null,
    status: "ready",
    authRequired: true,
    localDraftPending: true,
    conflict: null,
    error: "",
    errorScope: null,
    errorStatus: null,
  });
  return true;
}
