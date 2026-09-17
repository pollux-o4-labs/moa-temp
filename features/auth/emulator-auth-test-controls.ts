import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirebaseAuth } from "../../lib/firebase-app.ts";

type EmulatorAuthTestControls = {
  signIn(email: string, password: string): Promise<void>;
  signOut(): Promise<void>;
};

declare global {
  interface Window {
    __MOA_E2E_AUTH__?: EmulatorAuthTestControls;
  }
}

export function installEmulatorAuthTestControls() {
  const auth = getFirebaseAuth();
  if (!auth) return;

  window.__MOA_E2E_AUTH__ = {
    async signIn(email, password) {
      try {
        await signInWithEmailAndPassword(auth, email, password);
      } catch (error) {
        if (!(
          error &&
          typeof error === "object" &&
          "code" in error &&
          error.code === "auth/user-not-found"
        ))
          throw error;
        await createUserWithEmailAndPassword(auth, email, password);
      }
    },
    signOut() {
      return signOut(auth);
    },
  };
}
