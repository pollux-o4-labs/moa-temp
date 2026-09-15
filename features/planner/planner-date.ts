import { localDate } from "../../lib/plan-date.ts";

export type PlannerDateContext = {
  isToday: boolean;
  name: string;
  longName: string;
};

export function plannerDateContext(day: string): PlannerDateContext {
  const actualDay = day || localDate();
  const isToday = actualDay === localDate();
  const date = new Date(`${actualDay}T12:00:00`);
  return {
    isToday,
    name: isToday
      ? "오늘"
      : date.toLocaleDateString("ko-KR", {
          month: "long",
          day: "numeric",
        }),
    longName: date.toLocaleDateString("ko-KR", {
      year: "numeric",
      month: "long",
      day: "numeric",
      weekday: "long",
    }),
  };
}
