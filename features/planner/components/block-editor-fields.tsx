import { X } from "lucide-react";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  COLORS,
  CATEGORIES,
  MINUTES_PER_DAY,
  PLAN_LIMITS,
  type Block,
} from "@/lib/plan";
import { durationLabel } from "@/lib/plan-schedule";
import type { RefObject } from "react";
import { editorFieldVisibility } from "./editor-field-visibility";
import type { PlannerView } from "../planner-location";

export type EditorErrorField = "title" | "minutes" | "startMinute" | null;

type Props = {
  editor: Block;
  initial: Block;
  view: PlannerView;
  errorField: EditorErrorField;
  titleInputRef: RefObject<HTMLInputElement | null>;
  minutesInputRef: RefObject<HTMLInputElement | null>;
  startInputRef: RefObject<HTMLInputElement | null>;
  onChange(changes: Partial<Block>): void;
};

const QUICK_DURATIONS = [15, 30, 60, 120] as const;

function timeInputValue(minutes: number | null) {
  if (minutes === null) return "";
  const normalized = minutes % MINUTES_PER_DAY;
  return `${String(Math.floor(normalized / 60)).padStart(2, "0")}:${String(normalized % 60).padStart(2, "0")}`;
}

function minutesFromTime(value: string, nextDay: boolean) {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  if (!Number.isInteger(hours) || !Number.isInteger(minutes)) return null;
  return hours * 60 + minutes + (nextDay ? MINUTES_PER_DAY : 0);
}

export function BlockEditorFields({
  editor,
  initial,
  view,
  errorField,
  titleInputRef,
  minutesInputRef,
  startInputRef,
  onChange,
}: Props) {
  const { start: showStart, duration: showDuration } = editorFieldVisibility(
    initial,
    view
  );
  const hasNextDay =
    editor.startMinute !== null && editor.startMinute >= MINUTES_PER_DAY;
  return (
    <>
      <label className="field" htmlFor="block-title">
        할 일
        <input
          ref={titleInputRef}
          id="block-title"
          maxLength={PLAN_LIMITS.maxTitleLength}
          required
          aria-invalid={errorField === "title" || undefined}
          aria-describedby={
            errorField === "title" ? "block-editor-error" : undefined
          }
          placeholder="어떤 시간을 보내고 싶나요?"
          value={editor.title}
          onChange={(event) => onChange({ title: event.target.value })}
        />
      </label>
      {showStart && (
        <div className="field time-fields">
          <span>시작 시각</span>
          <div className="time-input-row">
            <input
              ref={startInputRef}
              id="block-start-time"
              type="time"
              aria-label="시작 시각"
              aria-invalid={errorField === "startMinute" || undefined}
              aria-describedby={
                errorField === "startMinute" ? "block-editor-error" : undefined
              }
              value={timeInputValue(editor.startMinute)}
              onChange={(event) =>
                onChange({
                  startMinute: minutesFromTime(event.target.value, hasNextDay),
                })
              }
            />
            {editor.startMinute !== null && (
              <button
                className="clear-field"
                type="button"
                aria-label="시작 시각 지우기"
                onClick={() => onChange({ startMinute: null })}
              >
                <X size={15} />
                지우기
              </button>
            )}
          </div>
          <label className="next-day-toggle">
            <input
              type="checkbox"
              checked={hasNextDay}
              disabled={editor.startMinute === null}
              onChange={(event) => {
                if (editor.startMinute === null) return;
                const base = editor.startMinute % MINUTES_PER_DAY;
                onChange({
                  startMinute:
                    base + (event.target.checked ? MINUTES_PER_DAY : 0),
                });
              }}
            />
            다음 날 기준으로 보기
          </label>
        </div>
      )}
      {showDuration && (
        <>
          <label className="field" htmlFor="block-minutes">
            소요 시간 <span className="optional-label">선택</span>
            <div className="minutes-input">
              <input
                ref={minutesInputRef}
                id="block-minutes"
                type="number"
                min={PLAN_LIMITS.minBlockMinutes}
                max={PLAN_LIMITS.maxBlockMinutes}
                aria-invalid={errorField === "minutes" || undefined}
                aria-describedby={
                  errorField === "minutes" ? "block-editor-error" : undefined
                }
                value={editor.minutes ?? ""}
                onChange={(event) =>
                  onChange({
                    minutes:
                      event.target.value === ""
                        ? null
                        : event.target.valueAsNumber,
                  })
                }
              />
              <span>분</span>
            </div>
          </label>
          <div
            className="quick-durations"
            role="group"
            aria-label="빠른 소요 시간 선택"
          >
            {QUICK_DURATIONS.map((minutes) => (
              <button
                type="button"
                key={minutes}
                className={editor.minutes === minutes ? "selected" : ""}
                aria-pressed={editor.minutes === minutes}
                onClick={() => onChange({ minutes })}
              >
                {durationLabel(minutes)}
              </button>
            ))}
            {editor.minutes !== null && (
              <button
                type="button"
                className="clear-duration"
                onClick={() => onChange({ minutes: null })}
              >
                시간 없음
              </button>
            )}
          </div>
        </>
      )}
      <fieldset className="field color-field">
        <legend id="block-color-label">
          블록의 종류 <span className="optional-label">선택</span>
        </legend>
        <RadioGroup
          className="color-options"
          value={editor.color ?? "none"}
          aria-labelledby="block-color-label"
          onKeyDown={(event) => {
            if (
              !["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(
                event.key
              )
            )
              return;
            const focusedColor = (event.target as HTMLElement).getAttribute(
              "value"
            );
            const index =
              focusedColor &&
              COLORS.includes(focusedColor as (typeof COLORS)[number])
                ? COLORS.indexOf(focusedColor as (typeof COLORS)[number])
                : editor.color
                  ? COLORS.indexOf(editor.color)
                  : -1;
            const offset =
              event.key === "ArrowUp" || event.key === "ArrowLeft" ? -1 : 1;
            const next =
              index < 0
                ? COLORS[offset < 0 ? COLORS.length - 1 : 0]
                : COLORS[(index + offset + COLORS.length) % COLORS.length];
            event.preventDefault();
            onChange({ color: next });
          }}
          onValueChange={(color) =>
            onChange({
              color: color === "none" ? null : (color as Block["color"]),
            })
          }
        >
          <label className="color-option neutral">
            <RadioGroupItem value="none" aria-label="종류 없음" />
            종류 없음
          </label>
          {COLORS.map((color) => (
            <label key={color} className={`color-option ${color}`}>
              <RadioGroupItem value={color} aria-label={CATEGORIES[color]} />
              {CATEGORIES[color]}
            </label>
          ))}
        </RadioGroup>
      </fieldset>
    </>
  );
}
