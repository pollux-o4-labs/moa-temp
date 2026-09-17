export function activeElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

export const PLANNER_FOCUS_FALLBACKS = {
  editor: [
    '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
    '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="add-block"]',
  ],
  date: [
    '[aria-label="계획 날짜"]',
    '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
  ],
  save: [
    '[data-planner-focus-target="recovery"]',
    '[aria-label="하루 시작 시간"]',
    '[aria-label="계획 날짜"]',
  ],
  conflict: [
    '[data-planner-focus-target="date-dialog-primary"]',
    '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
    '[aria-label="계획 날짜"]',
  ],
  conflictField: [
    '[data-slot="tabs-content"]:not([hidden]) [data-planner-focus-target="first-block"]',
    '[aria-label="계획 날짜"]',
  ],
} as const;

export function focusTarget(
  target: HTMLElement | null,
  fallbackSelectors: readonly string[]
) {
  if (target?.isConnected && !target.matches(":disabled")) {
    target.focus();
    return;
  }
  for (const selector of fallbackSelectors) {
    const candidate = document.querySelector<HTMLElement>(selector);
    if (candidate && !candidate.matches(":disabled")) {
      candidate.focus();
      return;
    }
  }
}
