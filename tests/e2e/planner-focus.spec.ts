import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("timeline edit focus keeps a visible width on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/?view=timeline");
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await edit.focus();

  const metrics = await edit.evaluate((element) => {
    const focus = element.getBoundingClientRect();
    const card = element.closest(".clay-block")?.getBoundingClientRect();
    return {
      focusWidth: focus.width,
      focusRight: focus.right,
      cardRight: card?.right ?? 0,
    };
  });
  expect(metrics.focusWidth).toBeGreaterThan(0);
  expect(metrics.focusRight).toBeLessThanOrEqual(metrics.cardRight);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
});

test("edit dialog focus rings have horizontal room on narrow screens", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/?view=blocks");
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await edit.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await dialog.waitFor();

  for (const name of ["삭제", "변경 적용"]) {
    const button = dialog.getByRole("button", { name });
    const metrics = await button.evaluate((element) => {
      const focus = element.getBoundingClientRect();
      const scroll = element
        .closest('[data-slot="dialog-scroll"]')
        ?.getBoundingClientRect();
      return {
        focusLeft: focus.left,
        focusRight: focus.right,
        scrollLeft: scroll?.left ?? 0,
        scrollRight: scroll?.right ?? 0,
      };
    });
    expect(metrics.focusLeft - 8).toBeGreaterThanOrEqual(metrics.scrollLeft);
    expect(metrics.focusRight + 8).toBeLessThanOrEqual(metrics.scrollRight);
  }
});
