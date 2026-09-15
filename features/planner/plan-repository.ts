import {
  loadedPlanSchema,
  PlanRepositoryError,
  revisionSchema,
  savedPlanSchema,
  type PlanRepository,
} from "@/lib/plan-contract";

const STORAGE_KEY_PREFIX = "moa:browser-plan:v1:";

function readStoredPlan(day: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(day));
    if (!raw) return null;
    const parsed = loadedPlanSchema.safeParse(JSON.parse(raw));
    if (!parsed.success)
      throw new PlanRepositoryError("저장 형식을 확인해주세요.", 502);
    return parsed.data;
  } catch (error) {
    if (error instanceof PlanRepositoryError) throw error;
    throw new PlanRepositoryError("브라우저 저장소를 읽지 못했어요.", 503);
  }
}

export const browserPlanRepository: PlanRepository = {
  async load(day) {
    return readStoredPlan(day) ?? { plan: null, revision: 0 };
  },
  async save(payload) {
    const current = readStoredPlan(payload.day) ?? { plan: null, revision: 0 };
    if (current.revision !== payload.revision)
      throw new PlanRepositoryError(
        "다른 창에서 계획이 변경되었어요. 최신 내용을 확인해주세요.",
        409
      );
    const revision = revisionSchema.parse(payload.revision + 1);
    const saved = savedPlanSchema.safeParse({ revision });
    if (!saved.success)
      throw new PlanRepositoryError("저장 버전을 확인해주세요.", 502);
    try {
      window.localStorage.setItem(
        keyFor(payload.day),
        JSON.stringify({ plan: payload.plan, revision })
      );
    } catch {
      throw new PlanRepositoryError(
        "브라우저에 계획을 저장하지 못했어요.",
        503
      );
    }
    return saved.data;
  },
};

function keyFor(day: string) {
  return `${STORAGE_KEY_PREFIX}${encodeURIComponent(day)}`;
}
