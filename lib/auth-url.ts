import { APP_ROUTES } from "./app-routes.ts";

const AUTH_VALIDATION_ORIGIN = "https://app.local";

export const AUTH_RETURN_PATH_KEY = "moa:auth:return-to";

type StorageLike = Pick<Storage, "getItem" | "removeItem" | "setItem">;

export interface AuthReturnPathStore {
  remember(path: string): void;
  consume(): string | null;
  clear(): void;
}

export const noAuthReturnPathStore: AuthReturnPathStore = {
  remember: () => undefined,
  consume: () => null,
  clear: () => undefined,
};

export function createAuthReturnPathStore(
  storage: StorageLike | null
): AuthReturnPathStore {
  if (!storage) return noAuthReturnPathStore;

  return {
    remember(path) {
      try {
        storage.setItem(AUTH_RETURN_PATH_KEY, safeRelativeReturnPath(path));
      } catch {
        // A blocked session store must never interrupt authentication.
      }
    },
    consume() {
      try {
        const path = storage.getItem(AUTH_RETURN_PATH_KEY);
        storage.removeItem(AUTH_RETURN_PATH_KEY);
        return path ? safeRelativeReturnPath(path) : null;
      } catch {
        return null;
      }
    },
    clear() {
      try {
        storage.removeItem(AUTH_RETURN_PATH_KEY);
      } catch {
        // Cleanup is best effort after a canceled or failed sign-in.
      }
    },
  };
}

export function createBrowserAuthReturnPathStore(): AuthReturnPathStore {
  if (typeof window === "undefined") return noAuthReturnPathStore;
  try {
    return createAuthReturnPathStore(window.sessionStorage);
  } catch {
    return noAuthReturnPathStore;
  }
}

export function safeRelativeReturnPath(value: string): string {
  if (!value.startsWith("/") || value.startsWith("//")) return APP_ROUTES.home;

  let url: URL;
  try {
    url = new URL(value, AUTH_VALIDATION_ORIGIN);
  } catch {
    return APP_ROUTES.home;
  }
  if (url.origin !== AUTH_VALIDATION_ORIGIN) return APP_ROUTES.home;
  return `${url.pathname}${url.search}${url.hash}`;
}
