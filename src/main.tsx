import { createRoot } from "react-dom/client";
import Planner from "@/app/planner";
import { readPlannerLocation } from "@/features/planner/planner-location";
import { registerPwaServiceWorker } from "@/src/pwa/register-service-worker";
import "@/app/globals.css";

const url = new URL(window.location.href);
const initialLocation = readPlannerLocation(url);
const root = document.getElementById("root");

if (!root) throw new Error("SPA root element is missing.");

registerPwaServiceWorker();

if (import.meta.env.VITE_FIREBASE_TEST_AUTH === "true") {
  void import("@/features/auth/emulator-auth-test-controls").then(
    ({ installEmulatorAuthTestControls }) => installEmulatorAuthTestControls()
  );
}

// Planner owns an imperative session with a cancellable initial load. Keeping
// one mount here prevents development-only effect replay from issuing a second
// load and changing the response ordering used by the session.
createRoot(root).render(<Planner initialLocation={initialLocation} />);
