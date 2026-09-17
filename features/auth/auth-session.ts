import {
  createBrowserAuthReturnPathStore,
  type AuthReturnPathStore,
} from "../../lib/auth-url.ts";

export type AuthStatus =
  "loading" | "signed_out" | "signed_in" | "unconfigured" | "error";

export type AuthUser = {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoUrl: string | null;
};

export type AuthSnapshot = {
  status: AuthStatus;
  user: AuthUser | null;
  error: string | null;
  busy: boolean;
};

export type AuthGateway = {
  subscribe(
    onUser: (user: AuthUser | null) => void,
    onError: (error: unknown) => void
  ): () => void;
  signInWithGoogle(): Promise<AuthUser | null>;
  signOut(): Promise<void>;
};

type AuthNavigation = {
  currentPath(): string;
  replace(path: string): void;
};

type AuthSessionOptions = {
  returnPathStore?: AuthReturnPathStore;
  navigation?: AuthNavigation;
  initialError?: string;
};

export class AuthSessionError extends Error {
  readonly code: string;
  readonly cancelled: boolean;

  constructor(
    message: string,
    options: { code?: string; cancelled?: boolean } = {}
  ) {
    super(message);
    this.name = "AuthSessionError";
    this.code = options.code ?? "auth/unknown";
    this.cancelled = options.cancelled ?? false;
  }
}

export function createAuthSession(
  gateway: AuthGateway | null,
  options: AuthSessionOptions = {}
) {
  const returnPathStore =
    options.returnPathStore ?? createBrowserAuthReturnPathStore();
  const navigation = options.navigation ?? browserNavigation;
  let snapshot: AuthSnapshot = gateway
    ? { status: "loading", user: null, error: null, busy: false }
    : {
        status: options.initialError ? "error" : "unconfigured",
        user: null,
        error: options.initialError ?? null,
        busy: false,
      };
  const initialSnapshot = snapshot;
  const listeners = new Set<() => void>();
  let unsubscribeGateway: (() => void) | null = null;

  function patch(update: Partial<AuthSnapshot>) {
    snapshot = { ...snapshot, ...update };
    listeners.forEach((listener) => listener());
  }

  function restoreReturnPath() {
    const returnPath = returnPathStore.consume();
    if (returnPath && returnPath !== navigation.currentPath())
      navigation.replace(returnPath);
  }

  function publishUser(user: AuthUser | null) {
    patch({
      status: user ? "signed_in" : "signed_out",
      user,
      error: null,
      busy: false,
    });
    if (user) restoreReturnPath();
  }

  if (gateway) {
    unsubscribeGateway = gateway.subscribe(publishUser, (error) =>
      patch({
        status: "error",
        user: null,
        error: authErrorMessage(error),
        busy: false,
      })
    );
  }

  async function signIn(returnTo = navigation.currentPath()): Promise<boolean> {
    if (!gateway || snapshot.busy) return false;

    returnPathStore.remember(returnTo);
    patch({ busy: true, error: null });
    try {
      const user = await gateway.signInWithGoogle();
      if (user) publishUser(user);
      else patch({ busy: false });
      return true;
    } catch (error) {
      returnPathStore.clear();
      if (error instanceof AuthSessionError && error.cancelled) {
        patch({ status: "signed_out", user: null, error: null, busy: false });
        return false;
      }
      patch({
        status: "error",
        user: null,
        error: authErrorMessage(error),
        busy: false,
      });
      return false;
    }
  }

  async function signOut(): Promise<boolean> {
    if (!gateway || snapshot.busy) return false;

    patch({ busy: true, error: null });
    try {
      await gateway.signOut();
      publishUser(null);
      return true;
    } catch (error) {
      patch({
        status: "error",
        error: authErrorMessage(error),
        busy: false,
      });
      return false;
    }
  }

  return {
    getSnapshot: () => snapshot,
    getServerSnapshot: () => initialSnapshot,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signIn,
    signOut,
    dispose() {
      unsubscribeGateway?.();
      unsubscribeGateway = null;
      listeners.clear();
    },
  };
}

export type AuthSession = ReturnType<typeof createAuthSession>;

function authErrorMessage(error: unknown): string {
  return error instanceof AuthSessionError
    ? error.message
    : "Google 로그인에 실패했어요. 다시 시도해주세요.";
}

const browserNavigation: AuthNavigation = {
  currentPath() {
    if (typeof window === "undefined") return "/";
    return `${window.location.pathname}${window.location.search}${window.location.hash}`;
  },
  replace(path) {
    if (typeof window === "undefined") return;
    window.history.replaceState({ auth: true }, "", path);
    window.dispatchEvent(new PopStateEvent("popstate"));
  },
};
