import { useSyncExternalStore } from "react";
import { readPlannerLocation, type PlannerView } from "./planner-location";

export function usePlannerView(initialView: PlannerView) {
  return useSyncExternalStore(
    (onChange) => {
      window.addEventListener("planner-view-change", onChange);
      window.addEventListener("popstate", onChange);
      return () => {
        window.removeEventListener("planner-view-change", onChange);
        window.removeEventListener("popstate", onChange);
      };
    },
    () => readPlannerLocation(new URL(window.location.href)).view,
    () => initialView
  );
}
