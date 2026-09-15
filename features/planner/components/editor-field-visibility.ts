import type { Block } from "@/lib/plan";
import type { PlannerView } from "../planner-location";

export type EditorFieldVisibility = {
  start: boolean;
  duration: boolean;
};

export function editorFieldVisibility(
  initial: Block,
  view: PlannerView
): EditorFieldVisibility {
  const showAll = view === "timeline";
  const start = showAll || initial.startMinute !== null;
  const duration = showAll || initial.minutes !== null;
  return { start, duration };
}
