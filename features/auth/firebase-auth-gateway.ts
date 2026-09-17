import {
  getRedirectResult,
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signInWithRedirect,
  signOut as firebaseSignOut,
  type Auth,
  type User,
} from "firebase/auth";
import {
  AuthSessionError,
  type AuthGateway,
  type AuthUser,
} from "./auth-session.ts";

const REDIRECT_FALLBACK_CODES = new Set([
  "auth/operation-not-supported-in-this-environment",
  "auth/popup-blocked",
]);

export function createFirebaseAuthGateway(auth: Auth): AuthGateway {
  return {
    subscribe(onUser, onError) {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => onUser(user ? toAuthUser(user) : null),
        (error) => onError(toAuthError(error))
      );
      void getRedirectResult(auth).catch((error) =>
        onError(toAuthError(error))
      );
      return unsubscribe;
    },
    async signInWithGoogle() {
      const provider = new GoogleAuthProvider();
      try {
        const result = await signInWithPopup(auth, provider);
        return toAuthUser(result.user);
      } catch (error) {
        const mapped = toAuthError(error);
        if (!REDIRECT_FALLBACK_CODES.has(mapped.code)) throw mapped;

        try {
          await signInWithRedirect(auth, provider);
          return null;
        } catch (redirectError) {
          throw toAuthError(redirectError);
        }
      }
    },
    async signOut() {
      try {
        await firebaseSignOut(auth);
      } catch (error) {
        throw toAuthError(error);
      }
    },
  };
}

function toAuthUser(user: User): AuthUser {
  return {
    uid: user.uid,
    email: user.email,
    displayName: user.displayName,
    photoUrl: user.photoURL,
  };
}

function toAuthError(error: unknown): AuthSessionError {
  if (error instanceof AuthSessionError) return error;

  const code =
    error &&
    typeof error === "object" &&
    "code" in error &&
    typeof error.code === "string"
      ? error.code
      : "auth/unknown";
  return new AuthSessionError(authErrorCopy(code), {
    code,
    cancelled: code === "auth/popup-closed-by-user",
  });
}

function authErrorCopy(code: string): string {
  switch (code) {
    case "auth/network-request-failed":
      return "네트워크 연결을 확인해주세요.";
    case "auth/too-many-requests":
      return "로그인 시도가 많아요. 잠시 후 다시 시도해주세요.";
    case "auth/unauthorized-domain":
      return "현재 주소가 Firebase 로그인 허용 목록에 없습니다.";
    case "auth/account-exists-with-different-credential":
      return "이미 다른 로그인 방식으로 등록된 계정이에요.";
    default:
      return "Google 로그인에 실패했어요. 다시 시도해주세요.";
  }
}
