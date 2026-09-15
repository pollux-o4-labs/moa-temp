import { useEffect, useRef } from "react";
import { activeElement, focusTarget } from "./planner-focus";

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
      focusTarget(target, [
        '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
        '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="add-block"]',
      ])
    );
  }, [editorOpen]);

  useEffect(() => {
    if (!dateReturnFocus.current || pendingDate !== null || loading || saving)
      return;
    const target = dateReturnFocus.current;
    dateReturnFocus.current = null;
    requestAnimationFrame(() =>
      focusTarget(target, [
        '[aria-label="계획 날짜"]',
        '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
      ])
    );
  }, [date, pendingDate, loading, saving]);

  useEffect(() => {
    if (saving || !saveReturnFocus.current) return;
    const target = saveReturnFocus.current;
    saveReturnFocus.current = null;
    requestAnimationFrame(() =>
      focusTarget(target, [
        '[data-planner-focus-target="recovery"]',
        '[aria-label="하루 시작 시간"]',
        '[aria-label="계획 날짜"]',
      ])
    );
  }, [saving]);

  return {
    captureEditorTrigger,
    captureDateTrigger,
    captureSaveTrigger,
  };
}
