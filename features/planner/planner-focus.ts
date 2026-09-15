export function activeElement(): HTMLElement | null {
  const active = document.activeElement;
  return active instanceof HTMLElement ? active : null;
}

export function focusTarget(
  target: HTMLElement | null,
  fallbackSelectors: string[]
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
