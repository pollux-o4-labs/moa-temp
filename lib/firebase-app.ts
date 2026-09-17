import { getApp, getApps, initializeApp, type FirebaseApp } from "firebase/app";
import { connectAuthEmulator, getAuth, type Auth } from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore,
} from "firebase/firestore";
import {
  readFirebaseWebConfig,
  shouldUseFirebaseAuthEmulator,
  shouldUseFirebaseFirestoreEmulator,
} from "./firebase-config.ts";

let auth: Auth | null = null;
let authEmulatorConnected = false;
let firestore: Firestore | null = null;
let firestoreEmulatorConnected = false;

export function getFirebaseApp(): FirebaseApp | null {
  const config = readFirebaseWebConfig(import.meta.env);
  if (!config) return null;

  return getApps().find((candidate) => candidate.name === "[DEFAULT]")
    ? getApp()
    : initializeApp(config);
}

export function getFirebaseAuth(): Auth | null {
  if (auth) return auth;

  const app = getFirebaseApp();
  if (!app) return null;
  auth = getAuth(app);

  if (
    shouldUseFirebaseAuthEmulator(import.meta.env) &&
    !authEmulatorConnected
  ) {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    authEmulatorConnected = true;
  }

  return auth;
}

export function getFirebaseFirestore(): Firestore | null {
  if (firestore) return firestore;

  const app = getFirebaseApp();
  if (!app) return null;
  firestore = getFirestore(app);

  if (
    shouldUseFirebaseFirestoreEmulator(import.meta.env) &&
    !firestoreEmulatorConnected
  ) {
    connectFirestoreEmulator(firestore, "127.0.0.1", 8080);
    firestoreEmulatorConnected = true;
  }

  return firestore;
}
