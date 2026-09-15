import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Check,
} from "lucide-react";
import { useEffect, useRef } from "react";
import { shiftDate } from "@/lib/plan-date";
import { plannerDateContext } from "../planner-date";
type Props = {
  date: string;
  loading: boolean;
  ready: boolean;
  saving: boolean;
  dirty: boolean;
  revision: number;
  unavailable: boolean;
  conflict: boolean;
  changeDate(day: string): void;
  save(): void;
};
export function PlanHeader({
  date,
  loading,
  ready,
  saving,
  dirty,
  revision,
  unavailable,
  conflict,
  changeDate,
  save,
}: Props) {
  const saveButtonRef = useRef<HTMLButtonElement>(null);
  const restoreSaveFocus = useRef(false);
  useEffect(() => {
    if (saving || !restoreSaveFocus.current) return;
    restoreSaveFocus.current = false;
    requestAnimationFrame(() => {
      if (dirty) saveButtonRef.current?.focus();
    });
  }, [dirty, saving]);
  const dateContext = plannerDateContext(date);
  const dateText = dateContext.longName;
  return (
    <div className="date-row">
      <div>
        <CalendarDays size={19} />
        <strong>
          {dateContext.isToday ? "오늘의 계획" : `${dateContext.name} 계획`}
        </strong>
        <div className="date-picker">
          <button
            aria-label="이전 날"
            disabled={loading || saving || conflict}
            onClick={() => changeDate(shiftDate(date, -1))}
          >
            <ChevronLeft size={15} />
          </button>
          <label>
            <span>{dateText}</span>
            <input
              type="date"
              aria-label="계획 날짜"
              value={date}
              disabled={loading || saving || conflict}
              onChange={(e) => {
                if (e.target.value) changeDate(e.target.value);
              }}
            />
          </label>
          <button
            aria-label="다음 날"
            disabled={loading || saving || conflict}
            onClick={() => changeDate(shiftDate(date, 1))}
          >
            <ChevronRight size={15} />
          </button>
        </div>
      </div>
      <button
        ref={saveButtonRef}
        className={`save-button ${dirty ? "unsaved" : ""}`}
        onClick={() => {
          restoreSaveFocus.current = true;
          save();
        }}
        disabled={!ready || saving || !dirty}
      >
        {saving ? (
          <Loader2 className="animate-spin" size={16} />
        ) : (
          <Check size={16} />
        )}{" "}
        {saving
          ? "저장 중"
          : unavailable
            ? "저장 불가"
            : dirty
              ? "계획 저장"
              : revision === 0
                ? "저장할 계획 없음"
                : "저장됨"}
      </button>
    </div>
  );
}
