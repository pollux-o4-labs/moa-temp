import { useEffect, useRef } from "react";
import { Layers3, PieChart, LayoutList, Clock3, Undo2 } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MINUTES_PER_HOUR, type Plan, type Block } from "@/lib/plan";
import { planSummary } from "@/lib/plan-summary";
import { timeLabel } from "@/lib/plan-schedule";
import type { PlanCommand } from "@/lib/plan-commands";
import { BlockList } from "./block-list";
import type { PlannerView } from "../planner-location";
import { Ring } from "./ring";
type Props = {
  plan: Plan;
  date: string;
  view: PlannerView;
  onViewChange(next: string): void;
  ready: boolean;
  saving: boolean;
  loading: boolean;
  revision: number;
  dirty: boolean;
  available: boolean;
  canUndo: boolean;
  historyLength: number;
  undo(): void;
  execute(command: PlanCommand): boolean;
  onAddTitle(title: string): boolean;
  onEdit(block?: Block, sourceView?: PlannerView): void;
};
export function PlanViews({
  plan,
  date,
  view,
  onViewChange,
  ready,
  saving,
  loading,
  revision,
  dirty,
  available,
  canUndo,
  historyLength,
  undo,
  execute,
  onAddTitle,
  onEdit,
}: Props) {
  const startTimeRef = useRef<HTMLInputElement>(null);
  const restoreUndoFocus = useRef(false);
  useEffect(() => {
    if (!restoreUndoFocus.current || canUndo) return;
    restoreUndoFocus.current = false;
    requestAnimationFrame(() => startTimeRef.current?.focus());
  }, [canUndo]);
  const { complete } = planSummary(plan);
  const startTimeValue = plan.start === null ? "" : timeLabel(plan.start);
  function renderRows(mode: PlannerView) {
    if (loading)
      return (
        <div className="loading-state" role="status">
          계획을 불러오는 중...
        </div>
      );
    if (!available)
      return (
        <div className="unavailable-state" role="status">
          이 날짜의 계획을 표시할 수 없어요.
        </div>
      );
    return (
      <BlockList
        plan={plan}
        date={date}
        mode={mode}
        enabled={ready && !saving}
        onEdit={(block) => onEdit(block, mode)}
        onAddTitle={onAddTitle}
        onComplete={(id, done) => execute({ type: "complete", id, done })}
        onReorder={(id, target) => execute({ type: "reorder", id, target })}
      />
    );
  }
  return (
    <Tabs value={view} onValueChange={onViewChange}>
      <div className="toolbar">
        <TabsList aria-label="시간표 보기 방식">
          <TabsTrigger value="blocks" disabled={loading}>
            <Layers3 />
            블록
          </TabsTrigger>
          <TabsTrigger value="circle" disabled={loading}>
            <PieChart />
            원형
          </TabsTrigger>
          <TabsTrigger value="timeline" disabled={loading}>
            <LayoutList />
            타임라인
          </TabsTrigger>
        </TabsList>
        <label className="start-time">
          <Clock3 size={15} />
          <span>하루 시작</span>
          <input
            ref={startTimeRef}
            type="time"
            aria-label="하루 시작 시간"
            value={startTimeValue}
            disabled={!ready || saving}
            onChange={(e) => {
              if (e.target.value) {
                const [h, m] = e.target.value.split(":").map(Number);
                execute({ type: "start", minutes: h * MINUTES_PER_HOUR + m });
              } else {
                execute({ type: "start", minutes: null });
              }
            }}
          />
        </label>
      </div>
      <div className="plan-meta">
        <span role="status" aria-live="polite" aria-atomic="true">
          {loading
            ? "계획을 불러오는 중..."
            : saving
              ? "저장 중..."
              : !available
                ? "이 날짜의 계획을 표시할 수 없어요."
                : revision === 0 && !dirty
                  ? plan.blocks.length === 0
                    ? "아직 저장된 계획이 없어요. 첫 블록을 추가해보세요."
                    : "예시 계획 · 나에게 맞게 바꾸고 저장해보세요."
                  : view === "blocks"
                    ? dirty
                      ? "저장하지 않은 변경"
                      : "저장된 계획"
                    : `${plan.blocks.length}개 블록 중 ${complete}개 완료${dirty ? " · 저장하지 않은 변경" : ""}`}
        </span>
        <button
          onClick={() => {
            if (canUndo && historyLength === 1) restoreUndoFocus.current = true;
            undo();
          }}
          disabled={!canUndo || saving || !ready}
        >
          <Undo2 size={14} />
          되돌리기
        </button>
      </div>
      <TabsContent value="blocks" tabIndex={-1}>
        {renderRows("blocks")}
      </TabsContent>
      <TabsContent value="timeline" tabIndex={-1}>
        {renderRows("timeline")}
      </TabsContent>
      <TabsContent value="circle" tabIndex={-1}>
        {!loading && available && (
          <div className="circle-surface">
            <Ring
              plan={plan}
              date={date}
              large
              onEdit={(id) => {
                const b = plan.blocks.find((b) => b.id === id);
                if (b && ready && !saving) onEdit(b, "circle");
              }}
            />
            <p>
              시간 비율을 간단히 보여줘요. 정확한 내용은 아래 목록에서
              확인하세요.
            </p>
          </div>
        )}
        {renderRows("circle")}
      </TabsContent>
    </Tabs>
  );
}
