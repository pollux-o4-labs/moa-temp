import { getFirebaseAuth } from "../../lib/firebase-app.ts";
import { createBrowserAuthReturnPathStore } from "../../lib/auth-url.ts";
import { createAuthSession, type AuthSession } from "./auth-session.ts";
import { createFirebaseAuthGateway } from "./firebase-auth-gateway.ts";

export function createBrowserAuthSession(): AuthSession {
  const returnPathStore = createBrowserAuthReturnPathStore();
  try {
    const auth = getFirebaseAuth();
    return createAuthSession(auth ? createFirebaseAuthGateway(auth) : null, {
      returnPathStore,
    });
  } catch {
    return createAuthSession(null, {
      returnPathStore,
      initialError: "Google 로그인 설정을 확인해주세요.",
    });
  }
}
