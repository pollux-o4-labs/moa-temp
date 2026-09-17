import {
  PlanRepositoryError,
  type PlanRepository,
} from "../../lib/plan-contract.ts";

// A static host may return the SPA document (200) or an error page (404) for
// an API path. Do not disguise network/server failures as authentication.
const STATIC_FALLBACK_STATUSES = new Set([200, 404]);

function staticFallback(error: unknown): never {
  if (
    error instanceof PlanRepositoryError &&
    STATIC_FALLBACK_STATUSES.has(error.status)
  ) {
    throw new PlanRepositoryError("로그인이 필요합니다.", 401);
  }
  throw error;
}

export function createStaticPlanRepository(
  repository: PlanRepository
): PlanRepository {
  return {
    async load(day) {
      try {
        return await repository.load(day);
      } catch (error) {
        return staticFallback(error);
      }
    },
    async save(payload) {
      try {
        return await repository.save(payload);
      } catch (error) {
        return staticFallback(error);
      }
    },
  };
}
