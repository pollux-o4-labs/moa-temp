import { expect, test, type Page } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

const visualDay = "2026-01-15";

async function openPlanner(page: Page) {
  // The first navigation completes the local auth mock; the second keeps the
  // visual fixture date deterministic across local time and CI.
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "오늘을 모아볼까요." })
  ).toBeVisible();
  await page.goto(`/?day=${visualDay}`);
  await expect(
    page.getByRole("heading", { name: /을 모아볼까요\./ })
  ).toBeVisible();
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
}

test.describe("planner visual regression", () => {
  test.beforeEach(async ({ page }) => {
    await mockSavedExamplePlan(page);
  });

  test("default blocks view", async ({ page }) => {
    await openPlanner(page);
    await expect(page).toHaveScreenshot("planner-default.png", {
      fullPage: true,
    });
  });

  test("timeline view", async ({ page }) => {
    await openPlanner(page);
    await page.getByRole("tab", { name: "타임라인" }).click();
    await expect(page).toHaveURL(/view=timeline/);
    await expect(page.getByRole("tab", { name: "타임라인" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page).toHaveScreenshot("planner-timeline.png", {
      fullPage: true,
    });
  });

  test("circle view", async ({ page }) => {
    await openPlanner(page);
    await page.getByRole("tab", { name: "원형" }).click();
    await expect(page).toHaveURL(/view=circle/);
    await expect(page.getByRole("tab", { name: "원형" })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    await expect(page).toHaveScreenshot("planner-circle.png", {
      fullPage: true,
    });
  });

  test("unsaved date-change dialog", async ({ page }) => {
    await openPlanner(page);
    await page.getByLabel("하루 시작 시간").fill("10:30");
    await page.getByRole("button", { name: "다음 날" }).click();
    await expect(
      page.getByRole("heading", { name: "변경사항이 있어요" })
    ).toBeVisible();
    await expect(page).toHaveScreenshot("planner-unsaved-dialog.png");
  });
});
