import { Loader2, LogIn, LogOut } from "lucide-react";
import type { AuthSnapshot } from "../auth-session.ts";

type Props = {
  snapshot: AuthSnapshot;
  onSignIn(): void;
  onSignOut(): void;
};

export function AuthControl({ snapshot, onSignIn, onSignOut }: Props) {
  if (snapshot.status === "unconfigured") return null;

  if (snapshot.status === "loading") {
    return (
      <div className="auth-control" aria-live="polite">
        <Loader2 className="animate-spin" size={15} />
        <span>로그인 상태 확인 중</span>
      </div>
    );
  }

  if (snapshot.status === "signed_in" && snapshot.user) {
    return (
      <div className="auth-control">
        <span className="auth-user" title={snapshot.user.email ?? undefined}>
          {snapshot.user.displayName ?? snapshot.user.email ?? "Google 계정"}
        </span>
        <button
          className="auth-button"
          type="button"
          disabled={snapshot.busy}
          onClick={onSignOut}
        >
          {snapshot.busy ? (
            <Loader2 className="animate-spin" size={15} />
          ) : (
            <LogOut size={15} />
          )}
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="auth-control">
      {snapshot.error && (
        <span className="auth-error" role="alert">
          {snapshot.error}
        </span>
      )}
      <button
        className="auth-button"
        type="button"
        disabled={snapshot.busy}
        onClick={onSignIn}
      >
        {snapshot.busy ? (
          <Loader2 className="animate-spin" size={15} />
        ) : (
          <LogIn size={15} />
        )}
        Google로 로그인
      </button>
    </div>
  );
}
