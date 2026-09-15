"use client";
import { useState } from "react";
import { Plus, Layers3, CalendarDays, GripVertical } from "lucide-react";
import { Toaster } from "@/components/ui/sonner";
import { createDraftBlock, type Block } from "@/lib/plan";
import { usePlanner } from "@/features/planner/use-planner";
import { authSignInPath } from "@/lib/auth-url";
import {
  plannerDateContext,
  type PlannerDateContext,
} from "@/features/planner/planner-date";
import type {
  PlannerLocation,
  PlannerView,
} from "@/features/planner/planner-location";
import { usePlannerView } from "@/features/planner/use-planner-view";
import { PlanHeader } from "@/features/planner/components/plan-header";
import { PlanViews } from "@/features/planner/components/plan-views";
import { Overview } from "@/features/planner/components/overview";
import { BlockEditor } from "@/features/planner/components/block-editor";
import { DateChangeDialog } from "@/features/planner/components/date-change-dialog";
import { ConflictRecoveryActions } from "@/features/planner/components/conflict-recovery-actions";
import { activeElement, focusTarget } from "@/features/planner/planner-focus";
import { usePlannerFocusRestoration } from "@/features/planner/use-planner-focus-restoration";

const defaultLocation: PlannerLocation = {
  day: null,
  view: "blocks",
  invalidDay: null,
  invalidView: null,
};

export default function Planner({
  initialLocation = defaultLocation,
  initialReturnTo = "/",
}: {
  initialLocation?: PlannerLocation;
  initialReturnTo?: string;
}) {
  const {
    state,
    dirty,
    locationWarning,
    errorStatus,
    execute,
    load,
    changeDate,
    resolveDate,
    resolveConflict,
    resolveConflictField,
    save,
    undo,
  } = usePlanner(initialLocation);
  const view = usePlannerView(initialLocation.view);
  const {
    plan,
    date,
    error,
    errorScope,
    revision,
    status,
    history,
    pendingDate,
    conflict,
  } = state;
  const dateContext: PlannerDateContext = plannerDateContext(date);
  const ready = status === "ready",
    saving = status === "saving",
    loading = status === "loading";
  const [editor, setEditor] = useState<Block | null>(null);
  const [editorView, setEditorView] = useState<PlannerView>(view);
  const [editorInitialFocus, setEditorInitialFocus] = useState<
    "title" | "minutes"
  >("title");
  const { captureEditorTrigger, captureDateTrigger, captureSaveTrigger } =
    usePlannerFocusRestoration({
      editorOpen: editor !== null,
      date,
      pendingDate,
      loading,
      saving,
    });

  function openEditor(block?: Block, sourceView: PlannerView = view) {
    const active = activeElement();
    captureEditorTrigger();
    setEditorView(sourceView);
    setEditorInitialFocus(
      active?.getAttribute("aria-label")?.includes("소요 시간")
        ? "minutes"
        : "title"
    );
    setEditor(block ?? createDraftBlock(crypto.randomUUID()));
  }
  function requestDate(day: string) {
    captureDateTrigger(day);
    void changeDate(day);
  }
  function savePlan() {
    captureSaveTrigger();
    void save();
  }
  function addTitle(title: string) {
    const block: Block = createDraftBlock(crypto.randomUUID(), title);
    return execute(
      { type: "upsert", block },
      "항목을 추가했어요. 다음 항목을 적어보세요."
    );
  }
  async function resolveConflictWithFocus(choice: "reload" | "reapply") {
    const target = activeElement();
    const resolved = await resolveConflict(choice);
    if (!resolved) return;
    requestAnimationFrame(() =>
      focusTarget(target, [
        '[data-planner-focus-target="date-dialog-primary"]',
        '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
        '[aria-label="계획 날짜"]',
      ])
    );
  }
  async function resolveConflictFieldWithFocus(
    id: string,
    field: Parameters<typeof resolveConflictField>[1],
    choice: Parameters<typeof resolveConflictField>[2]
  ) {
    const target = activeElement();
    const resolved = await resolveConflictField(id, field, choice);
    if (!resolved) return;
    requestAnimationFrame(() =>
      focusTarget(target, [
        '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
        '[aria-label="계획 날짜"]',
      ])
    );
  }

  return (
    <div className="app-shell">
      <Toaster position="bottom-center" theme="light" />
      <header className="topbar">
        {/* Native navigation preserves beforeunload protection for unsaved drafts. */}
        <a className="brand" href="/">
          <span className="brand-icon">
            <Layers3 size={23} />
          </span>
          모아<span className="brand-sub">나의 하루를 차곡차곡</span>
        </a>
        <span className="today-label">
          <CalendarDays size={16} />
          나만의 작은 계획 공간
        </span>
      </header>
      <main>
        <div className="page-title">
          <div>
            <span className="eyebrow">MY DAILY PLAN</span>
            <h1>
              {dateContext.name}을 모아볼까요<span>.</span>
            </h1>
            <p>계획이 바뀌어도 괜찮아요. 블록을 옮기면 되니까요.</p>
          </div>
          <button
            className="primary"
            disabled={!ready}
            onClick={() => openEditor()}
          >
            <Plus size={18} />새 블록
          </button>
        </div>
        <section
          className={`planner ${view === "blocks" ? "basic-view" : ""}`}
          aria-labelledby="planner-heading"
        >
          <h2 id="planner-heading" className="sr-only">
            {dateContext.isToday ? "오늘의 계획" : `${dateContext.name} 계획`}
          </h2>
          <div className="work-area" aria-busy={loading || saving}>
            <PlanHeader
              date={date}
              loading={loading}
              ready={ready}
              saving={saving}
              dirty={dirty}
              revision={revision}
              unavailable={status === "unavailable"}
              conflict={status === "conflict"}
              changeDate={requestDate}
              save={savePlan}
            />
            {(error || locationWarning) && (
              <div className="error-banner" role="alert">
                {locationWarning && <span>{locationWarning}</span>}
                {error && <span>{error}</span>}
                {errorStatus === 401 && (
                  <a
                    href={authSignInPath(initialReturnTo)}
                    onClick={(event) => {
                      const current =
                        window.location.pathname +
                        window.location.search +
                        window.location.hash;
                      event.currentTarget.href = authSignInPath(current);
                    }}
                  >
                    다시 로그인
                  </a>
                )}
                {status === "unavailable" && errorStatus !== 401 && (
                  <button onClick={() => load(date)}>다시 불러오기</button>
                )}
                {error && conflict && status === "conflict" && (
                  <ConflictRecoveryActions
                    onReload={() => void resolveConflictWithFocus("reload")}
                    onReapply={() => void resolveConflictWithFocus("reapply")}
                    conflict={conflict}
                    onResolveField={(id, field, choice) =>
                      void resolveConflictFieldWithFocus(id, field, choice)
                    }
                  />
                )}
              </div>
            )}
            <PlanViews
              plan={plan}
              date={date}
              initialView={initialLocation.view}
              ready={ready}
              saving={saving}
              loading={loading}
              revision={revision}
              dirty={dirty}
              available={status !== "unavailable"}
              canUndo={history.length > 0}
              historyLength={history.length}
              undo={undo}
              execute={execute}
              onAddTitle={addTitle}
              onEdit={openEditor}
            />
            {ready && plan.blocks.length > 0 && (
              <div className="drag-hint">
                <GripVertical size={16} />
                블록을 잡고 순서를 바꿔보세요.
              </div>
            )}
          </div>
          {view !== "blocks" && (
            <Overview
              plan={plan}
              date={date}
              loading={loading}
              unavailable={status === "unavailable"}
            />
          )}
        </section>
        <footer>
          <span>작은 계획이 모여, 나다운 하루.</span>
          <span>MADE FOR YOUR OWN PACE</span>
        </footer>
      </main>
      {editor && (
        <BlockEditor
          key={editor.id}
          initial={editor}
          error={error}
          errorScope={errorScope}
          plan={plan}
          view={editorView}
          initialFocus={editorInitialFocus}
          onClose={() => setEditor(null)}
          onApply={(block) => execute({ type: "upsert", block })}
          onRemove={(id) => execute({ type: "remove", id })}
        />
      )}
      <DateChangeDialog
        open={pendingDate !== null}
        targetDate={pendingDate}
        saving={saving}
        error={error}
        conflict={conflict}
        onResolve={resolveDate}
        onResolveConflict={(choice) => void resolveConflictWithFocus(choice)}
        onResolveConflictField={(id, field, choice) =>
          void resolveConflictFieldWithFocus(id, field, choice)
        }
      />
    </div>
  );
}
