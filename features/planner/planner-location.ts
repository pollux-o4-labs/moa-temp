import { dateSchema } from "../../lib/plan-date.ts";
import { plannerDateContext } from "./planner-date.ts";

export const PLANNER_VIEWS = ["blocks", "circle", "timeline"] as const;
export type PlannerView = (typeof PLANNER_VIEWS)[number];

export type PlannerLocation = {
  day: string | null;
  view: PlannerView;
  invalidDay: string | null;
  invalidView: string | null;
};

export const DEFAULT_PLANNER_LOCATION: PlannerLocation = {
  day: null,
  view: "blocks",
  invalidDay: null,
  invalidView: null,
};

export function isPlannerView(value: string | null): value is PlannerView {
  return value !== null && PLANNER_VIEWS.includes(value as PlannerView);
}

export function readPlannerLocation(url: URL): PlannerLocation {
  const rawDay = url.searchParams.get("day");
  const view = url.searchParams.get("view");
  const parsedDay = rawDay === null ? undefined : dateSchema.safeParse(rawDay);
  const validDay = rawDay === null || parsedDay?.success === true;
  return {
    day: validDay ? rawDay : null,
    view: isPlannerView(view) ? view : "blocks",
    invalidDay: rawDay !== null && !validDay ? rawDay : null,
    invalidView: view !== null && !isPlannerView(view) ? view : null,
  };
}

export function withPlannerLocation(
  url: URL,
  update: Partial<Pick<PlannerLocation, "day" | "view">>
): URL {
  const next = new URL(url);
  if (update.day !== undefined) {
    if (update.day) next.searchParams.set("day", update.day);
    else next.searchParams.delete("day");
  }
  if (update.view !== undefined) next.searchParams.set("view", update.view);
  return next;
}

export function normalizePlannerLocation(url: URL, fallbackDay: string): URL {
  const location = readPlannerLocation(url);
  const next = new URL(url);
  if (location.day === null) next.searchParams.set("day", fallbackDay);
  if (location.invalidView) next.searchParams.delete("view");
  return next;
}

export function plannerLocationWarning(
  location: PlannerLocation,
  fallbackDay: string
): string | null {
  const messages: string[] = [];
  if (location.invalidDay) {
    messages.push(
      `주소의 날짜(${location.invalidDay.slice(0, 32)})가 올바르지 않아 ${plannerDateContext(fallbackDay).name} 계획을 열었어요.`
    );
  }
  if (location.invalidView) {
    messages.push("지원하지 않는 보기라 블록 보기로 열었어요.");
  }
  return messages.length ? messages.join(" ") : null;
}
