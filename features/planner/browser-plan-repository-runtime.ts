import { getFirebaseAuth } from "../../lib/firebase-app.ts";
import type { PlanRepository } from "../../lib/plan-contract.ts";
import { createFirestorePlanRepository } from "./firestore-plan-repository.ts";
import { createAuthenticatedPlanRepository } from "./browser-plan-repository.ts";
import { httpPlanRepository } from "./plan-repository.ts";
import { createStaticPlanRepository } from "./static-plan-repository.ts";

export function createBrowserPlanRepository(): PlanRepository {
  return createAuthenticatedPlanRepository({
    auth: getFirebaseAuth(),
    authenticated: createFirestorePlanRepository(),
    anonymous: createStaticPlanRepository(httpPlanRepository),
  });
}
