"use client";
import { useEffect, useState, useSyncExternalStore } from "react";
import { toast } from "sonner";
import { dateSchema, localDate } from "@/lib/plan-date";
import type { BlockField } from "@/lib/plan-merge";
import type { PlanCommand } from "@/lib/plan-commands";
import { createPlannerSession, isDirty } from "./planner-session";
import {
  normalizePlannerLocation,
  plannerLocationWarning,
  readPlannerLocation,
  withPlannerLocation,
  type PlannerLocation,
} from "./planner-location";
import { browserPlanRepository } from "./plan-repository";
import { registerPlannerTools } from "./webmcp";
import { createBrowserLocalDraftStore } from "./local-draft";

const messages: Record<PlanCommand["type"], string | null> = {
  reorder: "블록을 옮기고 시간을 맞췄어요.",
  upsert: "블록을 적용했어요.",
  remove: "블록을 지웠어요. 되돌리기로 복원할 수 있어요.",
  complete: null,
  start: null,
};
const defaultLocation: PlannerLocation = {
  day: null,
  view: "blocks",
  invalidDay: null,
  invalidView: null,
};

type PlannerFeedback =
  | string
  | {
      message: string;
      action?: { label: string; onClick(): void };
    }
  | null;

export function usePlanner(initialLocation: PlannerLocation = defaultLocation) {
  const [session] = useState(() =>
    createPlannerSession(browserPlanRepository, initialLocation.day ?? "", {
      draftStore: createBrowserLocalDraftStore(),
    })
  );
  const [locationWarning, setLocationWarning] = useState<string | null>(() =>
    plannerLocationWarning(initialLocation, initialLocation.day ?? localDate())
  );
  const state = useSyncExternalStore(
    session.subscribe,
    session.getSnapshot,
    session.getServerSnapshot
  );
  const dirty = isDirty(state);
  function execute(command: PlanCommand, feedback?: PlannerFeedback) {
    const changed = session.execute(command);
    const message = feedback === undefined ? messages[command.type] : feedback;
    if (!changed || !message) return changed;
    if (typeof message === "string") {
      toast(message);
    } else {
      toast(message.message, message.action ? { action: message.action } : {});
    }
    return changed;
  }
  function pushDate(day: string) {
    const url = withPlannerLocation(new URL(window.location.href), { day });
    window.history.pushState({ planner: true }, "", url);
  }
  function changeDate(day: string) {
    const current = session.getSnapshot();
    const valid = dateSchema.safeParse(day).success;
    if (!valid) {
      void session.requestDate(day);
      return;
    }
    setLocationWarning(null);
    const needsConfirmation = isDirty(current);
    void session.requestDate(day);
    if (!needsConfirmation && day !== current.date) pushDate(day);
  }
  useEffect(() => {
    const location = readPlannerLocation(new URL(window.location.href));
    const day = location.day ?? localDate();
    const normalized = normalizePlannerLocation(
      new URL(window.location.href),
      day
    );
    if (normalized.href !== window.location.href)
      window.history.replaceState({ planner: true }, "", normalized);
    void session.load(day);
    return session.cancelLoad;
  }, [session]);
  useEffect(() => {
    function onPopState() {
      const location = readPlannerLocation(new URL(window.location.href));
      const current = session.getSnapshot();
      const day = location.day ?? localDate();
      setLocationWarning(plannerLocationWarning(location, day));
      if (isDirty(current) || current.status === "conflict") {
        const restored = withPlannerLocation(new URL(window.location.href), {
          day: current.date,
        });
        window.history.replaceState({ planner: true }, "", restored);
      } else if (day !== current.date) {
        void session.load(day);
      }
      window.dispatchEvent(new Event("planner-view-change"));
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [session]);
  useEffect(() => registerPlannerTools(session), [session]);
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  return {
    state,
    dirty,
    locationWarning,
    errorStatus: state.errorStatus,
    execute,
    load: session.load,
    changeDate,
    async resolveDate(choice: "save" | "discard" | "cancel") {
      const resolved = await session.resolveDate(choice);
      if (resolved && choice === "save")
        toast.success("계획을 저장하고 날짜를 이동했어요.");
      if (resolved) pushDate(session.getSnapshot().date);
      return resolved;
    },
    async resolveConflict(choice: "reload" | "reapply") {
      const resolved = await session.resolveConflict(choice);
      if (resolved && choice === "reapply")
        toast.success("변경 내용을 병합해 저장했어요.");
      return resolved;
    },
    async resolveConflictField(
      blockId: string,
      field: BlockField,
      choice: "local" | "latest"
    ) {
      const resolved = await session.resolveConflictField(
        blockId,
        field,
        choice
      );
      if (resolved) toast.success("충돌한 변경을 선택해 저장했어요.");
      return resolved;
    },
    async save() {
      const saved = await session.save();
      if (saved) toast.success("계획을 저장했어요.");
      return saved;
    },
    undo() {
      if (session.undo()) toast("이전 계획으로 되돌렸어요.");
    },
  };
}
