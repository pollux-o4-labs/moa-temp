export type FirebaseWebConfig = {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
};

type FirebaseEnv = Record<string, unknown>;

export function readFirebaseWebConfig(
  env: FirebaseEnv
): FirebaseWebConfig | null {
  const config: FirebaseWebConfig = {
    apiKey: stringValue(env.VITE_FIREBASE_API_KEY),
    authDomain: stringValue(env.VITE_FIREBASE_AUTH_DOMAIN),
    projectId: stringValue(env.VITE_FIREBASE_PROJECT_ID),
    storageBucket: stringValue(env.VITE_FIREBASE_STORAGE_BUCKET),
    messagingSenderId: stringValue(env.VITE_FIREBASE_MESSAGING_SENDER_ID),
    appId: stringValue(env.VITE_FIREBASE_APP_ID),
  };

  return Object.values(config).every(Boolean) ? config : null;
}

export function shouldUseFirebaseAuthEmulator(env: FirebaseEnv): boolean {
  return (
    env.MODE === "development" && env.VITE_FIREBASE_AUTH_EMULATOR === "true"
  );
}

export function shouldUseFirebaseFirestoreEmulator(env: FirebaseEnv): boolean {
  return (
    env.MODE === "development" &&
    env.VITE_FIREBASE_FIRESTORE_EMULATOR === "true"
  );
}

function stringValue(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}
