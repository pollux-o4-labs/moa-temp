import type { Auth } from "firebase/auth";
import type { PlanRepository } from "../../lib/plan-contract.ts";

type AuthReader = Pick<Auth, "currentUser">;

type BrowserPlanRepositoryDependencies = {
  auth?: AuthReader | null;
  authenticated: PlanRepository;
  anonymous: PlanRepository;
};

export function createAuthenticatedPlanRepository(
  dependencies: BrowserPlanRepositoryDependencies
): PlanRepository {
  return {
    load(day) {
      return selectRepository(dependencies).load(day);
    },
    save(payload) {
      return selectRepository(dependencies).save(payload);
    },
  };
}

function selectRepository(
  dependencies: BrowserPlanRepositoryDependencies
): PlanRepository {
  return dependencies.auth?.currentUser
    ? dependencies.authenticated
    : dependencies.anonymous;
}
