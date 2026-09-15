import { Plus, Layers3 } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { planSummary, type Plan, type Block } from "@/lib/plan";
import { durationLabel, schedule, timeLabel } from "@/lib/plan-schedule";
import { useBlockDrag } from "../use-block-drag";
import {
  blockAccessibleSummary,
  blockActionLabel,
} from "./block-accessibility";
import { BlockContent } from "./block-content";
import { BlockReorderHandle } from "./block-reorder-handle";
import { DragPreview } from "./drag-preview";
import { plannerDateContext } from "../planner-date";

const TIMELINE_MIN_HEIGHT_PX = 85;
const TIMELINE_MINUTES_TO_PX = 1.1;

type Props = {
  plan: Plan;
  date: string;
  mode: "blocks" | "timeline" | "circle";
  enabled: boolean;
  onEdit(block?: Block): void;
  onAddTitle(title: string): boolean;
  onComplete(id: string, done: boolean): void;
  onReorder(id: string, target: number): void;
};
export function BlockList({
  plan,
  date,
  mode,
  enabled,
  onEdit,
  onAddTitle,
  onComplete,
  onReorder,
}: Props) {
  const rows = schedule(plan);
  const { total } = planSummary(plan);
  const dateContext = plannerDateContext(date);
  const drag = useBlockDrag(plan.blocks, enabled, onReorder);
  const quickAddRef = useRef<HTMLInputElement>(null);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickError, setQuickError] = useState("");
  const previewBlock = plan.blocks.find(
    (block) => block.id === drag.preview?.id
  );
  return (
    <>
      {mode === "blocks" && (
        <form
          className="quick-add"
          onSubmit={(event: FormEvent) => {
            event.preventDefault();
            const title = quickTitle.trim();
            if (!title) {
              setQuickError("할 일을 적어주세요.");
              requestAnimationFrame(() => quickAddRef.current?.focus());
              return;
            }
            if (onAddTitle(title)) {
              setQuickTitle("");
              setQuickError("");
              requestAnimationFrame(() => quickAddRef.current?.focus());
            }
          }}
        >
          <label htmlFor="quick-add-title">새 항목</label>
          <input
            ref={quickAddRef}
            id="quick-add-title"
            value={quickTitle}
            maxLength={100}
            disabled={!enabled}
            placeholder="하고 싶은 일을 바로 적어보세요"
            aria-invalid={quickError ? "true" : undefined}
            aria-describedby={quickError ? "quick-add-error" : undefined}
            onChange={(event) => {
              setQuickTitle(event.target.value);
              if (quickError) setQuickError("");
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter" && event.nativeEvent.isComposing)
                event.preventDefault();
            }}
          />
          <button type="submit" className="primary" disabled={!enabled}>
            <Plus size={17} />
            추가
          </button>
          {quickError && (
            <span id="quick-add-error" role="alert">
              {quickError}
            </span>
          )}
        </form>
      )}
      <div
        className={`block-list ${mode === "timeline" ? "timeline-list" : ""} ${mode === "circle" ? "compact-list" : ""}`}
        role="list"
        aria-label="계획 블록"
      >
        {rows.map((b, i) => {
          const labelMode = mode === "blocks" ? "basic" : "detailed";
          const summary = blockAccessibleSummary(
            b,
            mode === "blocks" ? null : b.resolvedStart,
            labelMode
          );
          const tone = mode === "blocks" ? "neutral" : (b.color ?? "neutral");
          const savedBlock =
            plan.blocks.find((block) => block.id === b.id) ?? b;
          return (
            <div
              className={`schedule-row ${drag.overId === b.id && drag.dragId !== b.id ? `drop-target ${drag.dropAfter ? "drop-after" : ""}` : ""}`}
              data-block-id={b.id}
              key={b.id}
              role="listitem"
              aria-label={summary}
              {...drag.rowProps(b.id, i)}
            >
              <span
                className={`time-label ${mode !== "timeline" ? "time-label-hidden" : ""}`}
                aria-hidden={mode !== "timeline"}
              >
                {mode === "timeline" && b.resolvedStart !== null
                  ? timeLabel(b.resolvedStart)
                  : ""}
                {mode === "timeline" && b.resolvedEnd !== null && (
                  <small>{timeLabel(b.resolvedEnd)}</small>
                )}
              </span>
              <article
                {...drag.blockProps(b.id)}
                className={`clay-block ${tone} ${b.done ? "is-done" : ""} ${drag.dragId === b.id ? "is-dragging" : ""} ${drag.preview?.id === b.id ? "native-source" : ""}`}
                style={
                  mode === "timeline"
                    ? {
                        minHeight:
                          b.layoutMode === "order"
                            ? TIMELINE_MIN_HEIGHT_PX
                            : Math.max(
                                TIMELINE_MIN_HEIGHT_PX,
                                b.slotMinutes * TIMELINE_MINUTES_TO_PX
                              ),
                      }
                    : undefined
                }
              >
                <BlockReorderHandle
                  index={i}
                  count={rows.length}
                  disabled={!enabled}
                  label={`${blockActionLabel(b, mode === "blocks" ? null : b.resolvedStart, "순서 이동", labelMode)}, 현재 ${i + 1}번째 / ${rows.length}개, 위아래 방향키 사용, Enter로 이동 메뉴 열기`}
                  getGripProps={(onClick) => drag.gripProps(b.id, i, onClick)}
                  onMove={(target) => onReorder(b.id, target)}
                />
                <button
                  className="edit-block"
                  onClick={() => onEdit(savedBlock)}
                  disabled={!enabled}
                  aria-label={blockActionLabel(
                    b,
                    mode === "blocks" ? null : b.resolvedStart,
                    "수정",
                    labelMode
                  )}
                >
                  <BlockContent block={b} showCategory={mode !== "blocks"} />
                </button>
                {mode !== "blocks" && (
                  <button
                    className="duration"
                    onClick={() => onEdit(savedBlock)}
                    disabled={!enabled}
                    aria-label={blockActionLabel(
                      b,
                      b.resolvedStart,
                      "소요 시간 수정"
                    )}
                  >
                    {durationLabel(b.minutes) || "시간 설정"}
                  </button>
                )}
                <Checkbox
                  className="done-check"
                  aria-label={blockActionLabel(
                    b,
                    mode === "blocks" ? null : b.resolvedStart,
                    "완료 여부",
                    labelMode
                  )}
                  checked={b.done}
                  disabled={!enabled}
                  onCheckedChange={(done) => onComplete(b.id, done === true)}
                />
              </article>
            </div>
          );
        })}
        {!rows.length && (
          <div className="empty-plan" role="listitem" aria-label="빈 계획">
            <Layers3 size={34} />
            <h3>가볍게, 하나부터 시작해요.</h3>
            <p>{dateContext.name} 하고 싶은 일을 첫 블록에 담아보세요.</p>
          </div>
        )}
        <div
          className="schedule-row"
          role="listitem"
          aria-label="다음 블록 추가"
        >
          <span
            className={`time-label ${mode !== "timeline" ? "time-label-hidden" : ""}`}
            aria-hidden={mode !== "timeline"}
          >
            {mode === "timeline" && plan.start !== null
              ? timeLabel(plan.start + total)
              : ""}
          </span>
          <button
            className="add-block"
            data-planner-focus-target="add-block"
            disabled={!enabled}
            onClick={() => onEdit()}
          >
            <Plus size={19} />
            다음 블록을 놓아보세요
          </button>
        </div>
      </div>
      <DragPreview
        block={previewBlock}
        preview={drag.preview}
        compact={mode === "circle"}
        setElement={drag.setPreviewElement}
        setImage={drag.setDragImage}
      />
    </>
  );
}
