import { ZodError } from "zod";
import { emptyPlan, PLAN_LIMITS, samePlan, type Plan } from "../../lib/plan.ts";
import { dateSchema } from "../../lib/plan-date.ts";
import { demoPlan } from "../../lib/plan-fixtures.ts";
import { applyPlanCommand, type PlanCommand } from "../../lib/plan-commands.ts";
import {
  type BlockField,
  type MergeConflictDetail,
} from "../../lib/plan-merge.ts";
import {
  PlanRepositoryError,
  type PlanRepository,
} from "../../lib/plan-contract.ts";
import { noLocalDraftStore, type LocalDraftStore } from "./local-draft.ts";
import {
  resolvePlannerConflict,
  resolvePlannerConflictField,
} from "./planner-session-conflicts.ts";

type Status = "loading" | "ready" | "saving" | "conflict" | "unavailable";
type ErrorScope = "request" | "command" | null;
export type PlannerState = {
  plan: Plan;
  date: string;
  status: Status;
  error: string;
  errorScope: ErrorScope;
  errorStatus: number | null;
  revision: number;
  saved: Plan;
  history: Plan[];
  pendingDate: string | null;
  conflict: ConflictState | null;
  authRequired: boolean;
};
export type ConflictState = {
  draft: Plan;
  base: Plan;
  latest: Plan | null;
  details: MergeConflictDetail[];
};
export function isDirty(state: PlannerState) {
  return (
    (state.status === "ready" ||
      state.status === "saving" ||
      state.status === "conflict") &&
    !samePlan(state.plan, state.saved)
  );
}

export function createPlannerSession(
  repository: PlanRepository,
  initialDate = "",
  options: { draftStore?: LocalDraftStore } = {}
) {
  const draftStore = options.draftStore ?? noLocalDraftStore;
  const example = demoPlan();
  let state: PlannerState = {
    plan: example,
    date: initialDate,
    status: "loading",
    error: "",
    errorScope: null,
    errorStatus: null,
    revision: 0,
    saved: example,
    history: [],
    pendingDate: null,
    conflict: null,
    authRequired: false,
  };
  const initialState = state;
  const listeners = new Set<() => void>();
  let requestId = 0;
  function patch(update: Partial<PlannerState>) {
    state = { ...state, ...update };
    listeners.forEach((listener) => listener());
  }
  function fail(error: unknown, scope: Exclude<ErrorScope, null> = "request") {
    patch({
      errorScope: scope,
      errorStatus: error instanceof PlanRepositoryError ? error.status : null,
      error:
        error instanceof PlanRepositoryError && error.status === 401
          ? "로그인 세션이 만료되었어요. 다시 로그인해주세요."
          : error instanceof ZodError
            ? (error.issues[0]?.message ?? "입력 내용을 확인해주세요.")
            : error instanceof Error
              ? error.message
              : "요청을 처리하지 못했어요.",
    });
  }
  async function load(day: string) {
    if (state.status === "saving") return false;
    const parsed = dateSchema.safeParse(day);
    if (!parsed.success) {
      patch({
        error: "날짜를 확인해주세요.",
        errorScope: "request",
        errorStatus: null,
      });
      return false;
    }
    const id = ++requestId;
    const blank = emptyPlan();
    patch({
      date: parsed.data,
      plan: blank,
      status: "loading",
      error: "",
      errorScope: null,
      errorStatus: null,
      pendingDate: null,
      conflict: null,
      revision: 0,
      saved: blank,
      history: [],
      authRequired: false,
    });
    try {
      const result = await repository.load(parsed.data);
      if (id !== requestId) return false;
      const plan = result.plan ?? emptyPlan();
      patch({
        plan,
        revision: result.revision,
        saved: plan,
        history: [],
        status: "ready",
        conflict: null,
        authRequired: false,
      });
      return true;
    } catch (error) {
      if (id === requestId) {
        if (error instanceof PlanRepositoryError && error.status === 401) {
          const draft = draftStore.read(parsed.data) ?? emptyPlan();
          patch({
            plan: draft,
            saved: draft,
            revision: 0,
            history: [],
            status: "ready",
            error: "",
            errorScope: null,
            errorStatus: null,
            conflict: null,
            authRequired: true,
          });
          return true;
        }
        fail(error);
        patch({ status: "unavailable" });
      }
      return false;
    }
  }
  function execute(command: PlanCommand) {
    if (state.status !== "ready") return false;
    try {
      const next = applyPlanCommand(state.plan, command);
      if (samePlan(next, state.plan)) {
        if (state.error)
          patch({ error: "", errorScope: null, errorStatus: null });
        return false;
      }
      patch({
        plan: next,
        history: [
          ...state.history.slice(-(PLAN_LIMITS.history - 1)),
          state.plan,
        ],
        error: "",
        errorScope: null,
        errorStatus: null,
      });
      if (state.authRequired) draftStore.write(state.date, next);
      return true;
    } catch (error) {
      fail(error, "command");
      return false;
    }
  }
  function undo() {
    if (state.status !== "ready" || !state.history.length) return false;
    patch({
      plan: state.history[state.history.length - 1],
      history: state.history.slice(0, -1),
      error: "",
      errorScope: null,
      errorStatus: null,
    });
    if (state.authRequired) draftStore.write(state.date, state.plan);
    return true;
  }
  async function save() {
    if (state.status !== "ready") return false;
    const { date: day, plan, revision } = state;
    const base = state.saved;
    patch({
      status: "saving",
      error: "",
      errorScope: null,
      errorStatus: null,
    });
    try {
      const result = await repository.save({ day, plan, revision });
      patch({
        revision: result.revision,
        saved: plan,
        status: "ready",
        conflict: null,
        authRequired: false,
      });
      if (state.authRequired) draftStore.remove(day);
      return true;
    } catch (error) {
      fail(error);
      if (error instanceof PlanRepositoryError && error.status === 409) {
        patch({
          status: "conflict",
          conflict: { draft: plan, base, latest: null, details: [] },
        });
      } else {
        patch({ status: "ready" });
      }
      return false;
    }
  }
  async function requestDate(day: string) {
    if (
      state.status === "saving" ||
      state.status === "conflict" ||
      day === state.date
    )
      return;
    if (!dateSchema.safeParse(day).success) {
      patch({ error: "날짜를 확인해주세요.", errorScope: "request" });
      return;
    }
    if (isDirty(state)) patch({ pendingDate: day });
    else await load(day);
  }
  async function resolveDate(choice: "save" | "discard" | "cancel") {
    const day = state.pendingDate;
    if (!day || state.status === "saving") return false;
    if (choice === "cancel") {
      patch({ pendingDate: null });
      return false;
    }
    if (choice === "save" && !(await save())) return false;
    return load(day);
  }
  async function resolveConflict(choice: "reload" | "reapply") {
    return resolvePlannerConflict(
      {
        getState: () => state,
        patch,
        nextRequestId: () => ++requestId,
        isCurrentRequest: (id) => id === requestId,
        fail,
        load: async (day) => repository.load(day),
        save,
      },
      choice
    );
  }
  async function resolveConflictField(
    blockId: string,
    field: BlockField,
    choice: "local" | "latest"
  ) {
    return resolvePlannerConflictField(
      {
        getState: () => state,
        patch,
        nextRequestId: () => ++requestId,
        isCurrentRequest: (id) => id === requestId,
        fail,
        load: async (day) => repository.load(day),
        save,
      },
      blockId,
      field,
      choice
    );
  }
  return {
    getSnapshot: () => state,
    getServerSnapshot: () => initialState,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    load,
    execute,
    undo,
    save,
    requestDate,
    resolveDate,
    resolveConflict,
    resolveConflictField,
    cancelLoad() {
      requestId++;
    },
  };
}
export type PlannerSession = ReturnType<typeof createPlannerSession>;
