"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createBrowserAuthSession } from "./browser-auth-session.ts";

export function useAuth() {
  const [session] = useState(() => createBrowserAuthSession());
  const snapshot = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot
  );

  useEffect(() => () => session.dispose(), [session]);

  return {
    ...snapshot,
    signIn: session.signIn,
    signOut: session.signOut,
  };
}
