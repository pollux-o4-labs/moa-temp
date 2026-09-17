import { emptyPlan } from "../../lib/plan.ts";
import { mergePlans } from "../../lib/plan-merge.ts";
import type { BlockField } from "../../lib/block-fields.ts";
import { applyConflictFieldChoice } from "./planner-session-conflict.ts";
import type { PlannerState } from "./planner-session.ts";

type SessionContext = {
  getState(): PlannerState;
  patch(update: Partial<PlannerState>): void;
  nextRequestId(): number;
  isCurrentRequest(id: number): boolean;
  fail(error: unknown): void;
  load(day: string): Promise<{
    plan: PlannerState["plan"] | null;
    revision: number;
  }>;
  save(): Promise<boolean>;
};

export async function resolvePlannerConflict(
  context: SessionContext,
  choice: "reload" | "reapply"
) {
  const state = context.getState();
  const conflict = state.conflict;
  const day = state.date;
  if (!conflict || state.status !== "conflict") return false;
  const id = context.nextRequestId();
  context.patch({
    status: "loading",
    error: "",
    errorScope: null,
    errorStatus: null,
  });
  try {
    const result = await context.load(day);
    if (!context.isCurrentRequest(id)) return false;
    const latest = result.plan ?? emptyPlan();
    if (choice === "reload") {
      context.patch({
        plan: latest,
        revision: result.revision,
        saved: latest,
        history: [],
        status: "ready",
        conflict: null,
      });
      return true;
    }
    const merged = mergePlans(conflict.base, conflict.draft, latest);
    if (!merged.plan) {
      context.patch({
        plan: conflict.draft,
        revision: result.revision,
        status: "conflict",
        conflict: { ...conflict, latest, details: merged.details },
        errorScope: "request",
        error:
          "같은 항목이 최신 내용에서도 바뀌어 자동 병합할 수 없어요 (" +
          merged.conflicts.join(", ") +
          "). 최신 내용을 불러오거나 변경을 다시 확인해주세요.",
      });
      return false;
    }
    context.patch({
      plan: merged.plan,
      revision: result.revision,
      saved: latest,
      history: [],
      status: "ready",
      error: "",
      conflict: null,
    });
    return context.save();
  } catch (error) {
    if (!context.isCurrentRequest(id)) return false;
    const current = context.getState();
    context.fail(error);
    context.patch({
      status: current.conflict ? "conflict" : "ready",
    });
    return false;
  }
}

export async function resolvePlannerConflictField(
  context: SessionContext,
  blockId: string,
  field: BlockField,
  choice: "local" | "latest"
) {
  const state = context.getState();
  const conflict = state.conflict;
  if (!conflict || !conflict.latest || state.status !== "conflict")
    return false;
  const resolved = applyConflictFieldChoice(conflict, blockId, field, choice);
  if (!resolved) return false;
  const { latest, draft } = resolved;
  const merged = mergePlans(conflict.base, draft, latest);
  if (!merged.plan) {
    context.patch({
      plan: draft,
      conflict: { ...conflict, draft, latest, details: merged.details },
      error: "충돌한 필드를 모두 선택하면 변경 내용을 저장할 수 있어요.",
      errorScope: "request",
    });
    return false;
  }
  context.patch({
    plan: merged.plan,
    saved: latest,
    status: "ready",
    error: "",
    errorScope: null,
    history: [],
    conflict: null,
  });
  return context.save();
}
