import assert from "node:assert/strict";
import test from "node:test";
import { deleteApp, initializeApp } from "firebase/app";
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  doc,
  getDoc,
  getFirestore,
  setDoc,
  terminate,
  Timestamp,
} from "firebase/firestore";
import { createFirestorePlanRepository } from "../../features/planner/firestore-plan-repository.ts";
import { demoPlan } from "../../lib/plan-fixtures.ts";

const app = initializeApp(
  {
    apiKey: "demo-api-key",
    authDomain: "timep-tp.firebaseapp.com",
    projectId: "timep-tp",
    storageBucket: "timep-tp.appspot.com",
    messagingSenderId: "1005539646389",
    appId: "demo-app-id",
  },
  `firebase-emulator-test-${process.pid}`
);
const auth = getAuth(app);
const firestore = getFirestore(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
connectFirestoreEmulator(firestore, "127.0.0.1", 8080);

async function expectDenied(operation, label) {
  await assert.rejects(operation, (error) => {
    assert.equal(error.code, "permission-denied", label);
    return true;
  });
}

test("Firestore rules isolate accounts and preserve revision conflicts", async () => {
  const password = "test-password-123";
  const suffix = `${Date.now()}-${crypto.randomUUID()}`;
  const emailA = `rules-a-${suffix}@example.com`;
  const emailB = `rules-b-${suffix}@example.com`;
  const day = "2099-01-01";
  const repository = createFirestorePlanRepository({ auth, firestore });
  const plan = demoPlan();

  const credentialA = await createUserWithEmailAndPassword(
    auth,
    emailA,
    password
  );
  const uidA = credentialA.user.uid;
  assert.equal((await repository.save({ day, plan, revision: 0 })).revision, 1);
  assert.equal((await repository.load(day)).revision, 1);
  await assert.rejects(
    repository.save({ day, plan, revision: 0 }),
    (error) => error.status === 409
  );

  await signOut(auth);
  const credentialB = await createUserWithEmailAndPassword(
    auth,
    emailB,
    password
  );
  const uidB = credentialB.user.uid;
  const planA = doc(firestore, "users", uidA, "plans", day);
  const planB = doc(firestore, "users", uidB, "plans", day);
  await expectDenied(() => getDoc(planA), "account B cannot read account A");
  await expectDenied(
    () => setDoc(planA, { plan, revision: 2, updatedAt: Timestamp.now() }),
    "account B cannot write account A"
  );
  await setDoc(planB, { plan, revision: 1, updatedAt: Timestamp.now() });
  await expectDenied(
    () =>
      setDoc(doc(firestore, "users", uidB, "plans", "forged"), {
        owner: uidB,
        plan,
        revision: 1,
        updatedAt: Timestamp.now(),
      }),
    "owner forgery is rejected"
  );
  await expectDenied(
    () =>
      setDoc(doc(firestore, "users", uidB, "plans", "legacy"), {
        plan: { start: 540, blocks: [] },
        revision: 1,
        updatedAt: Timestamp.now(),
      }),
    "legacy plan shape is rejected"
  );

  await signOut(auth);
  await expectDenied(() => getDoc(planA), "unauthenticated read is rejected");
  await terminate(firestore);
  await deleteApp(app);
});
