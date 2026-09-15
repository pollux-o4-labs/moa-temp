import {
  COLORS,
  MINUTES_PER_HOUR,
  STORAGE_SCHEMA_VERSION,
  type Plan,
} from "./plan.ts";

export const PLAN_DEFAULTS = {
  startMinutes: 9 * MINUTES_PER_HOUR,
  blockMinutes: 30,
  blockColor: COLORS[0],
} as const;

/** Example data used only while a new planner has no saved record. */
export function demoPlan(): Plan {
  return {
    schemaVersion: STORAGE_SCHEMA_VERSION,
    start: PLAN_DEFAULTS.startMinutes,
    blocks: [
      {
        id: "study",
        title: "깊이 집중해서 공부하기",
        startMinute: null,
        minutes: 120,
        color: "blue",
        done: false,
      },
      {
        id: "shopping",
        title: "친구와 장보기",
        startMinute: null,
        minutes: 60,
        color: "peach",
        done: false,
      },
      {
        id: "rest",
        title: "점심 먹고 잠깐 쉬기",
        startMinute: null,
        minutes: 60,
        color: "green",
        done: false,
      },
      {
        id: "journal",
        title: "오늘의 생각, 일기 쓰기",
        startMinute: null,
        minutes: PLAN_DEFAULTS.blockMinutes,
        color: "yellow",
        done: false,
      },
    ],
  };
}
