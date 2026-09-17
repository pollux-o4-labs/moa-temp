import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("saving returns focus to the planner after the save button is disabled", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 2 }),
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  await page.getByLabel("하루 시작 시간").fill("10:30");
  const save = page.getByRole("button", { name: "계획 저장" });
  await save.focus();
  await save.press("Enter");
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  await expect(page.getByLabel("하루 시작 시간")).toBeFocused();
});

test("saving keeps the UI busy and announces the saving state", async ({
  page,
}) => {
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await response;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 1 }),
    });
  });
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toHaveValue("09:00");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.locator(".work-area")).toHaveAttribute("aria-busy", "true");
  await expect(page.getByText("저장 중...", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "저장 중" })).toBeDisabled();
  release();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  await expect(page.locator(".work-area")).toHaveAttribute(
    "aria-busy",
    "false"
  );
});

test("saving in the date dialog hides its close affordance", async ({
  page,
}) => {
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await response;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 2 }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "다음 날" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "저장하고 이동" }).click();
  await expect(dialog.getByRole("button", { name: "닫기" })).toHaveCount(0);
  release();
  await expect(dialog).toHaveCount(0);
});

test("saving before date navigation shows a success announcement", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 1 }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "다음 날" }).click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "저장하고 이동" })
    .click();
  await expect(
    page.getByText("계획을 저장하고 날짜를 이동했어요.")
  ).toBeVisible();
});
