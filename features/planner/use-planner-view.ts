import { useSyncExternalStore } from "react";
import {
  isPlannerView,
  readPlannerLocation,
  withPlannerLocation,
  type PlannerView,
} from "./planner-location";

export function usePlannerView(initialView: PlannerView) {
  const view = useSyncExternalStore(
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

  function changeView(next: string) {
    if (typeof window !== "undefined" && isPlannerView(next)) {
      const url = withPlannerLocation(new URL(window.location.href), {
        view: next,
      });
      window.history.pushState({ planner: true }, "", url);
      window.dispatchEvent(new Event("planner-view-change"));
    }
  }

  return { view, changeView };
}
