import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("planner loads and protects unsaved date changes", async ({ page }) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "오늘을 모아볼까요." })
  ).toBeVisible();
  const startTime = page.getByLabel("하루 시작 시간");
  await expect(startTime).toHaveValue("09:00");
  await startTime.fill("10:30");
  await expect(page.getByRole("button", { name: "계획 저장" })).toBeEnabled();
  await page.getByRole("button", { name: "다음 날" }).click();
  await expect(
    page.getByRole("heading", { name: "변경사항이 있어요" })
  ).toBeVisible();
  await page.getByRole("button", { name: "계속 편집" }).click();
  await expect(page.getByLabel("계획 날짜")).toHaveValue(/\d{4}-\d{2}-\d{2}/);
});

test("loading does not expose example blocks before the plan response", async ({
  page,
}) => {
  let release!: () => void;
  const response = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/plans**", async (route) => {
    await response;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan: null, revision: 0 }),
    });
  });
  await page.goto("/");
  await expect(page.locator(".loading-state")).toBeVisible();
  await expect(page.locator("[data-block-id]")).toHaveCount(0);
  release();
  await expect(page.locator("[data-block-id]")).toHaveCount(0);
  await expect(
    page.getByText("아직 저장된 계획이 없어요. 첫 블록을 추가해보세요.")
  ).toBeVisible();
});

test("empty plans show an add action without a drag-only hint", async ({
  page,
}) => {
  await page.route("**/api/plans**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan: null, revision: 0 }),
    });
  });
  await page.goto("/");
  await expect(page.getByText("가볍게, 하나부터 시작해요.")).toBeVisible();
  await expect(page.locator(".drag-hint")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /다음 블록을 놓아보세요/ })
  ).toBeEnabled();
});

test("malformed API errors become safe user-facing recovery messages", async ({
  page,
}) => {
  await page.route("**/api/plans**", async (route) => {
    await route.fulfill({
      status: 503,
      contentType: "text/html",
      body: "<html>gateway failure</html>",
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "요청을 처리하지 못했어요."
  );
  await expect(page.getByRole("alert")).not.toContainText("Unexpected");
});

test("unauthenticated loads enter anonymous mode with an enabled add CTA", async ({
  page,
}) => {
  await page.route("**/api/plans**", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "로그인이 필요합니다." }),
    });
  });
  await page.goto("/");
  await expect(page.locator("[data-block-id]")).toHaveCount(0);
  await expect(page.getByText("가볍게, 하나부터 시작해요.")).toBeVisible();
  await expect(page.getByRole("button", { name: /새 블록/ })).toBeEnabled();
});

test("hanging loads become a retryable timeout state", async ({ page }) => {
  test.setTimeout(15_000);
  await page.route("**/api/plans**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 7_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan: null, revision: 0 }),
    });
  });
  await page.goto("/");
  await expect(page.getByRole("alert")).toContainText(
    "요청 시간이 초과됐어요.",
    { timeout: 8_000 }
  );
  await expect(
    page.getByRole("button", { name: "다시 불러오기" })
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /새 블록/ })).toBeDisabled();
});

test("hanging saves keep the draft and return to a retryable state", async ({
  page,
}) => {
  test.setTimeout(15_000);
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await new Promise((resolve) => setTimeout(resolve, 7_000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 2 }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "요청 시간이 초과됐어요.",
    { timeout: 8_000 }
  );
  await expect(page.getByRole("button", { name: "계획 저장" })).toBeEnabled();
  await expect(page.getByLabel("하루 시작 시간")).toHaveValue("10:30");
});

test("valid editor input clears its previous form error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: /새 블록/ }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "블록 추가" }).click();
  await expect(dialog.getByRole("alert")).toContainText("할 일을 적어주세요.");
  await dialog.getByLabel("할 일").fill("새 계획");
  await expect(dialog.getByRole("alert")).toHaveCount(0);
});
