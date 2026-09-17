"use client";

import { useEffect, useRef } from "react";
import type { AuthSnapshot } from "../auth/auth-session";
import type { PlannerState } from "./planner-session";

type Props = {
  auth: AuthSnapshot;
  status: PlannerState["status"];
  authRequired: boolean;
  reconcileAuthenticatedUser(): Promise<boolean>;
  reloadAuthenticatedUser(): Promise<boolean>;
  reconcileSignedOutUser(): boolean;
};

/** Keeps the plan session aligned with Firebase account transitions. */
export function usePlannerAuthSync({
  auth,
  status,
  authRequired,
  reconcileAuthenticatedUser,
  reloadAuthenticatedUser,
  reconcileSignedOutUser,
}: Props) {
  const previousUid = useRef<string | null>(null);

  useEffect(() => {
    if (auth.status === "signed_in" && auth.user) {
      const accountChanged =
        previousUid.current !== null && previousUid.current !== auth.user.uid;
      previousUid.current = auth.user.uid;
      if (accountChanged) {
        void reloadAuthenticatedUser();
        return;
      }
      if (status === "ready" && authRequired) void reconcileAuthenticatedUser();
      return;
    }
    if (auth.status === "signed_out" && previousUid.current) {
      previousUid.current = null;
      void reconcileSignedOutUser();
    }
  }, [
    auth.status,
    auth.user,
    authRequired,
    status,
    reconcileAuthenticatedUser,
    reloadAuthenticatedUser,
    reconcileSignedOutUser,
  ]);
}
