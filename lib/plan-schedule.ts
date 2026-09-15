import {
  MINUTES_PER_DAY,
  MINUTES_PER_HOUR,
  normalizePlanShape,
  type Block,
  type Plan,
} from "./plan.ts";

export const DISPLAY_SLOT_MINUTES = 30;

export type ScheduleRow = Block & {
  /** Layout coordinates. They may use the 30-minute display slot. */
  start: number;
  end: number;
  /** Wall-clock values safe to present as user-entered time. */
  resolvedStart: number | null;
  resolvedEnd: number | null;
  slotMinutes: number;
  usesSlot: boolean;
  layoutMode: "time" | "order";
};

/** Projects saved values into display coordinates without changing the plan. */
export function schedule(plan: Plan): ScheduleRow[] {
  const normalizedPlan = normalizePlanShape(plan);
  let cursor = normalizedPlan.start;
  let fallbackCursor = 0;
  const rows: ScheduleRow[] = normalizedPlan.blocks.map((block) => {
    const explicitStartValue = block.startMinute;
    const start =
      explicitStartValue !== null
        ? explicitStartValue
        : cursor !== null
          ? cursor
          : fallbackCursor;
    const slotMinutes = block.minutes ?? DISPLAY_SLOT_MINUTES;
    const end = start + slotMinutes;
    const resolvedStart =
      explicitStartValue !== null
        ? explicitStartValue
        : normalizedPlan.start !== null && cursor !== null
          ? cursor
          : null;
    const resolvedEnd =
      resolvedStart !== null && block.minutes !== null
        ? resolvedStart + block.minutes
        : null;
    const row: ScheduleRow = {
      ...block,
      start,
      end,
      resolvedStart,
      resolvedEnd,
      slotMinutes,
      usesSlot: block.minutes === null,
      layoutMode: "time",
    };
    if (cursor !== null || explicitStartValue !== null) cursor = end;
    else fallbackCursor = end;
    return row;
  });

  let segmentStart = 0;
  for (let index = 0; index < normalizedPlan.blocks.length; index++) {
    if (normalizedPlan.blocks[index].startMinute === null) continue;
    const anchor = rows[index].start;
    const predictedEnd = rows
      .slice(segmentStart, index)
      .reduce(
        (end, row) => Math.max(end, row.end),
        rows[segmentStart]?.start ?? 0
      );
    if (predictedEnd > anchor) {
      for (let rowIndex = segmentStart; rowIndex <= index; rowIndex++)
        rows[rowIndex].layoutMode = "order";
    }
    segmentStart = index;
  }
  return rows;
}

export function timeLabel(minutes: number) {
  const day = Math.floor(minutes / MINUTES_PER_DAY);
  const m = minutes % MINUTES_PER_DAY;
  return `${day ? "다음 날 " : ""}${String(Math.floor(m / MINUTES_PER_HOUR)).padStart(2, "0")}:${String(m % MINUTES_PER_HOUR).padStart(2, "0")}`;
}

export function durationLabel(minutes: number | null) {
  if (minutes === null) return "";
  return `${Math.floor(minutes / MINUTES_PER_HOUR) ? `${Math.floor(minutes / MINUTES_PER_HOUR)}시간` : ""}${minutes % MINUTES_PER_HOUR ? `${minutes >= MINUTES_PER_HOUR ? " " : ""}${minutes % MINUTES_PER_HOUR}분` : minutes === 0 ? "0분" : ""}`;
}
