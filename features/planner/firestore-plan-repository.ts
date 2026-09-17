import {
  doc,
  getDoc,
  runTransaction,
  Timestamp,
  type Firestore,
} from "firebase/firestore";
import type { Auth } from "firebase/auth";
import {
  loadedPlanSchema,
  PlanRepositoryError,
  savePlanSchema,
  type PlanRepository,
} from "../../lib/plan-contract.ts";
import {
  getFirebaseAuth,
  getFirebaseFirestore,
} from "../../lib/firebase-app.ts";

const USERS_COLLECTION = "users";
const PLANS_COLLECTION = "plans";

type AuthReader = Pick<Auth, "currentUser">;

type FirestorePlanRepositoryDependencies = {
  auth?: AuthReader | null;
  firestore?: Firestore | null;
};

export function createFirestorePlanRepository(
  dependencies: FirestorePlanRepositoryDependencies = {}
): PlanRepository {
  const auth = dependencies.auth ?? getFirebaseAuth();
  const firestore = dependencies.firestore ?? getFirebaseFirestore();

  return {
    async load(day) {
      const user = requireCurrentUser(auth);
      const database = requireFirestore(firestore);
      try {
        const snapshot = await getDoc(planReference(database, user.uid, day));
        if (!snapshot.exists()) return { plan: null, revision: 0 };

        return readStoredPlan(snapshot.data());
      } catch (error) {
        throw mapFirestoreError(error);
      }
    },

    async save(payload) {
      const parsedPayload = savePlanSchema.safeParse(payload);
      if (!parsedPayload.success)
        throw new PlanRepositoryError("저장할 계획 형식을 확인해주세요.", 400);

      const user = requireCurrentUser(auth);
      const database = requireFirestore(firestore);
      try {
        return await runTransaction(database, async (transaction) => {
          const reference = planReference(database, user.uid, payload.day);
          const snapshot = await transaction.get(reference);
          const currentRevision = snapshot.exists()
            ? readStoredPlan(snapshot.data()).revision
            : 0;
          if (currentRevision !== payload.revision)
            throw new PlanRepositoryError(
              "다른 곳에서 계획이 변경되었어요.",
              409
            );

          const revision = currentRevision + 1;
          transaction.set(reference, {
            plan: parsedPayload.data.plan,
            revision,
            updatedAt: Timestamp.now(),
          });
          return { revision };
        });
      } catch (error) {
        throw mapFirestoreError(error);
      }
    },
  };
}

function planReference(database: Firestore, uid: string, day: string) {
  return doc(database, USERS_COLLECTION, uid, PLANS_COLLECTION, day);
}

function requireCurrentUser(
  auth: AuthReader | null
): NonNullable<AuthReader["currentUser"]> {
  const user = auth?.currentUser;
  if (!user) throw new PlanRepositoryError("로그인 세션이 필요합니다.", 401);
  return user;
}

function requireFirestore(database: Firestore | null): Firestore {
  if (!database)
    throw new PlanRepositoryError("저장 기능을 준비하지 못했어요.", 503);
  return database;
}

function readStoredPlan(
  data: Record<string, unknown>
): ReturnType<typeof loadedPlanSchema.parse> {
  if (
    !Object.keys(data).every((key) =>
      ["plan", "revision", "updatedAt"].includes(key)
    ) ||
    !(data.updatedAt instanceof Timestamp)
  )
    throw new PlanRepositoryError("저장된 계획 형식을 확인해주세요.", 502);

  const parsed = loadedPlanSchema.safeParse({
    plan: data.plan ?? null,
    revision: data.revision ?? 0,
  });
  if (!parsed.success)
    throw new PlanRepositoryError("저장된 계획 형식을 확인해주세요.", 502);
  return parsed.data;
}

function mapFirestoreError(error: unknown): PlanRepositoryError {
  if (error instanceof PlanRepositoryError) return error;

  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "";
  if (code === "unauthenticated")
    return new PlanRepositoryError("로그인 세션이 필요합니다.", 401);
  if (code === "permission-denied")
    return new PlanRepositoryError("저장 권한을 확인해주세요.", 403);
  if (
    code === "unavailable" ||
    code === "deadline-exceeded" ||
    code === "network-request-failed"
  )
    return new PlanRepositoryError(
      "인터넷 연결을 확인한 뒤 다시 시도해주세요.",
      503
    );
  if (error instanceof Error)
    return new PlanRepositoryError(error.message, 502);
  return new PlanRepositoryError("저장 요청을 처리하지 못했어요.", 502);
}
