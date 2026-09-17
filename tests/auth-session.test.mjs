import test from "node:test";
import assert from "node:assert/strict";
import {
  AUTH_RETURN_PATH_KEY,
  createAuthReturnPathStore,
} from "../lib/auth-url.ts";
import {
  AuthSessionError,
  createAuthSession,
} from "../features/auth/auth-session.ts";
import {
  readFirebaseWebConfig,
  shouldUseFirebaseAuthEmulator,
  shouldUseFirebaseFirestoreEmulator,
} from "../lib/firebase-config.ts";

function memoryStorage() {
  const values = new Map();
  return {
    values,
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function navigation(path = "/") {
  let current = path;
  const replacements = [];
  return {
    replacements,
    currentPath: () => current,
    replace(path) {
      current = path;
      replacements.push(path);
    },
  };
}

function fakeGateway({ user = null, signInError = null } = {}) {
  let onUser;
  let signedInUser = user;
  return {
    subscribe(next) {
      onUser = next;
      next(signedInUser);
      return () => undefined;
    },
    async signInWithGoogle() {
      if (signInError) throw signInError;
      signedInUser = {
        uid: "google-user",
        email: "user@example.com",
        displayName: "Google User",
        photoUrl: null,
      };
      onUser(signedInUser);
      return signedInUser;
    },
    async signOut() {
      signedInUser = null;
      onUser(null);
    },
  };
}

const googleUser = {
  uid: "restored-user",
  email: "restored@example.com",
  displayName: "Restored User",
  photoUrl: null,
};

test("Firebase config requires every public web setting", () => {
  const env = {
    VITE_FIREBASE_API_KEY: "api-key",
    VITE_FIREBASE_AUTH_DOMAIN: "timep-tp.firebaseapp.com",
    VITE_FIREBASE_PROJECT_ID: "timep-tp",
    VITE_FIREBASE_STORAGE_BUCKET: "timep-tp.firebasestorage.app",
    VITE_FIREBASE_MESSAGING_SENDER_ID: "1005539646389",
    VITE_FIREBASE_APP_ID: "app-id",
    MODE: "development",
  };

  assert.deepEqual(readFirebaseWebConfig(env), {
    apiKey: "api-key",
    authDomain: "timep-tp.firebaseapp.com",
    projectId: "timep-tp",
    storageBucket: "timep-tp.firebasestorage.app",
    messagingSenderId: "1005539646389",
    appId: "app-id",
  });
  assert.equal(
    readFirebaseWebConfig({ ...env, VITE_FIREBASE_APP_ID: "" }),
    null
  );
  assert.equal(shouldUseFirebaseAuthEmulator({ ...env }), false);
  assert.equal(
    shouldUseFirebaseAuthEmulator({
      ...env,
      VITE_FIREBASE_AUTH_EMULATOR: "true",
    }),
    true
  );
  assert.equal(
    shouldUseFirebaseFirestoreEmulator({
      ...env,
      VITE_FIREBASE_FIRESTORE_EMULATOR: "true",
    }),
    true
  );
  assert.equal(
    shouldUseFirebaseAuthEmulator({
      ...env,
      MODE: "production",
      VITE_FIREBASE_AUTH_EMULATOR: "true",
    }),
    true
  );
  assert.equal(
    shouldUseFirebaseFirestoreEmulator({
      ...env,
      MODE: "production",
      VITE_FIREBASE_FIRESTORE_EMULATOR: "true",
    }),
    true
  );
});

test("auth session restores a safe deep link after a restored Firebase user", () => {
  const storage = memoryStorage();
  const returnPaths = createAuthReturnPathStore(storage);
  const target = "/?day=2026-09-17&view=timeline";
  returnPaths.remember(target);
  const browser = navigation();

  const session = createAuthSession(fakeGateway({ user: googleUser }), {
    returnPathStore: returnPaths,
    navigation: browser,
  });

  assert.equal(session.getSnapshot().status, "signed_in");
  assert.deepEqual(session.getSnapshot().user, googleUser);
  assert.deepEqual(browser.replacements, [target]);
  assert.equal(storage.values.has(AUTH_RETURN_PATH_KEY), false);
});

test("auth session keeps the return path safe and supports sign-in and sign-out", async () => {
  const storage = memoryStorage();
  const returnPaths = createAuthReturnPathStore(storage);
  const browser = navigation("/?day=2026-09-17");
  const session = createAuthSession(fakeGateway(), {
    returnPathStore: returnPaths,
    navigation: browser,
  });

  assert.equal(await session.signIn("//external.example"), true);
  assert.equal(session.getSnapshot().status, "signed_in");
  assert.equal(browser.replacements[0], "/");
  assert.equal(storage.values.has(AUTH_RETURN_PATH_KEY), false);

  assert.equal(await session.signOut(), true);
  assert.equal(session.getSnapshot().status, "signed_out");
  assert.equal(session.getSnapshot().user, null);
});

test("canceled sign-in clears only auth state and does not publish an error", async () => {
  const storage = memoryStorage();
  const returnPaths = createAuthReturnPathStore(storage);
  const session = createAuthSession(
    fakeGateway({
      signInError: new AuthSessionError("취소", {
        code: "auth/popup-closed-by-user",
        cancelled: true,
      }),
    }),
    { returnPathStore: returnPaths }
  );

  assert.equal(await session.signIn("/?day=2026-09-17"), false);
  assert.equal(session.getSnapshot().status, "signed_out");
  assert.equal(session.getSnapshot().error, null);
  assert.equal(storage.values.has(AUTH_RETURN_PATH_KEY), false);
});
