export type AuthUser = {
  provider: string;
  userId: string;
  displayName: string;
  email: string;
  fullName: string | null;
};

export type AuthSession = {
  user: AuthUser | null;
};

/**
 * Server-side authentication seam. Concrete providers only resolve the
 * current session; route and planner code do not depend on provider SDKs.
 */
export interface AuthSessionProvider {
  getSession(): Promise<AuthSession>;
}
