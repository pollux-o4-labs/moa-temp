import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan, savedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("deep links preserve the requested date and view from the first screen", async ({
  page,
}) => {
  await page.goto("/?day=2024-02-28&view=timeline");
  await expect(page.getByLabel("계획 날짜")).toHaveValue("2024-02-28");
  await expect(page.getByRole("tab", { name: "타임라인" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await expect(page.getByRole("heading", { name: /2월 28일을/ })).toBeVisible();
});

test("invalid date and view parameters are explained and normalized", async ({
  page,
}) => {
  await page.goto("/?day=2024-02-30&view=unknown");
  await expect(page.getByRole("alert")).toContainText("주소의 날짜");
  await expect(page.getByRole("alert")).toContainText("지원하지 않는 보기");
  await expect(page).toHaveURL(/day=\d{4}-\d{2}-\d{2}/);
  await expect(page).not.toHaveURL(/view=unknown/);
  await expect(page.getByRole("tab", { name: "블록" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
});

test("date and view history restore the previous planner context", async ({
  page,
}) => {
  await page.goto("/?day=2026-01-15");
  await page.getByRole("button", { name: "다음 날" }).click();
  await expect(page).toHaveURL(/day=2026-01-16/);
  await page.getByRole("tab", { name: "타임라인" }).click();
  await expect(page).toHaveURL(/day=2026-01-16&view=timeline/);

  await page.goBack();
  await expect(page).toHaveURL(/day=2026-01-16(?!.*view=)/);
  await expect(page.getByRole("tab", { name: "블록" })).toHaveAttribute(
    "aria-selected",
    "true"
  );
  await page.goBack();
  await expect(page).toHaveURL(/day=2026-01-15/);
  await expect(page.getByLabel("계획 날짜")).toHaveValue("2026-01-15");
});

test("date confirmation names the destination date", async ({ page }) => {
  await page.goto("/?day=2026-01-15");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "다음 날" }).click();
  const dialog = page.getByRole("dialog");
  await expect(
    dialog.getByRole("heading", { name: "변경사항이 있어요" })
  ).toBeVisible();
  await expect(dialog).toContainText("1월 16일");
  await expect(
    dialog.getByRole("button", { name: "저장하고 이동" })
  ).toBeVisible();
});

test("expired API sessions offer the current authentication action", async ({
  page,
}) => {
  await page.unrouteAll();
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() === "GET") {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ plan: savedExamplePlan, revision: 1 }),
      });
      return;
    }
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "로그인이 필요합니다." }),
    });
  });
  await page.goto("/?day=2024-02-28&view=timeline");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "로그인 세션이 만료되었어요"
  );
  const signIn = page.getByRole("alert").getByRole("button");
  await expect(signIn).toBeVisible();
  await expect(signIn).toHaveText(/Google로 로그인|로그인 설정 필요/);

  await page.getByRole("button", { name: "다음 날" }).click();
  const dateDialog = page.getByRole("dialog");
  await expect(dateDialog).toContainText("로그인 세션이 만료되었어요");
  await expect(
    dateDialog.getByRole("button", { name: /Google로 로그인|로그인 설정 필요/ })
  ).toHaveCount(0);
  await expect(
    dateDialog.getByRole("button", { name: "저장하고 이동" })
  ).toBeVisible();
});
