import { useEffect, useRef } from "react";
import {
  activeElement,
  focusTarget,
  PLANNER_FOCUS_FALLBACKS,
} from "./planner-focus";

type Props = {
  editorOpen: boolean;
  date: string;
  pendingDate: string | null;
  loading: boolean;
  saving: boolean;
};

/** Keeps focus restoration policy out of the page composition component. */
export function usePlannerFocusRestoration({
  editorOpen,
  date,
  pendingDate,
  loading,
  saving,
}: Props) {
  const editorReturnFocus = useRef<HTMLElement | null>(null);
  const dateReturnFocus = useRef<HTMLElement | null>(null);
  const saveReturnFocus = useRef<HTMLElement | null>(null);

  function captureEditorTrigger() {
    editorReturnFocus.current = activeElement();
  }

  function captureDateTrigger(nextDate: string) {
    if (nextDate !== date) dateReturnFocus.current = activeElement();
  }

  function captureSaveTrigger() {
    saveReturnFocus.current = activeElement();
  }

  useEffect(() => {
    if (editorOpen || !editorReturnFocus.current) return;
    const target = editorReturnFocus.current;
    editorReturnFocus.current = null;
    requestAnimationFrame(() =>
      focusTarget(target, PLANNER_FOCUS_FALLBACKS.editor)
    );
  }, [editorOpen]);

  useEffect(() => {
    if (!dateReturnFocus.current || pendingDate !== null || loading || saving)
      return;
    const target = dateReturnFocus.current;
    dateReturnFocus.current = null;
    requestAnimationFrame(() =>
      focusTarget(target, PLANNER_FOCUS_FALLBACKS.date)
    );
  }, [date, pendingDate, loading, saving]);

  useEffect(() => {
    if (saving || !saveReturnFocus.current) return;
    const target = saveReturnFocus.current;
    saveReturnFocus.current = null;
    requestAnimationFrame(() =>
      focusTarget(target, PLANNER_FOCUS_FALLBACKS.save)
    );
  }, [saving]);

  return {
    captureEditorTrigger,
    captureDateTrigger,
    captureSaveTrigger,
  };
}
