import { expect, test } from "@playwright/test";
import { savedExamplePlan, mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("an unresolved save conflict exposes recovery and blocks editing", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "다른 창에서 계획이 변경되었어요." }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("alert")).toContainText(
    "다른 창에서 계획이 변경되었어요."
  );
  await expect(
    page.getByRole("button", { name: "최신 내용 불러오기" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "내 변경 다시 적용" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "최신 내용 불러오기" })
  ).toBeFocused();
  await expect(page.getByLabel("하루 시작 시간")).toBeDisabled();
  await expect(page.getByRole("button", { name: "다음 날" })).toBeDisabled();
  await expect(
    page.getByRole("heading", { name: "계획을 저장하고 이동할까요?" })
  ).toHaveCount(0);
  await expect(page.getByRole("button", { name: "되돌리기" })).toBeDisabled();
  await page.getByRole("button", { name: "최신 내용 불러오기" }).click();
  await expect(
    page.getByRole("heading", {
      name: "내 변경을 버리고 최신 내용을 불러올까요?",
    })
  ).toBeVisible();
  await page.getByRole("button", { name: "취소" }).click();
  await expect(
    page.getByRole("button", { name: "최신 내용 불러오기" })
  ).toBeVisible();
  await page.getByRole("button", { name: "최신 내용 불러오기" }).click();
  await page
    .getByRole("button", { name: "내 변경 버리고 최신 내용 불러오기" })
    .click();
  await expect(page.getByRole("alert")).toHaveCount(0);
});

test("same-block independent edits merge and preserve both values", async ({
  page,
}) => {
  let loads = 0;
  let saves = 0;
  const latest = {
    ...savedExamplePlan,
    blocks: savedExamplePlan.blocks.map((block, index) =>
      index === 0 ? { ...block, done: true } : block
    ),
  };
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() === "GET") {
      loads++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: loads === 1 ? savedExamplePlan : latest,
          revision: loads === 1 ? 1 : 2,
        }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      saves++;
      await route.fulfill({
        status: saves === 1 ? 409 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          saves === 1
            ? { error: "다른 창에서 계획이 변경되었어요." }
            : { revision: 3 }
        ),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /깊이 집중해서 공부하기 수정/ })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("할 일").fill("내 제목");
  await editor.getByRole("button", { name: "변경 적용" }).click();
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(
    page.getByRole("button", { name: "내 변경 다시 적용" })
  ).toBeVisible();
  await page.getByRole("button", { name: "내 변경 다시 적용" }).click();
  await expect(page.getByText("변경 내용을 병합해 저장했어요.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /내 제목 수정/ })
  ).toBeVisible();
  await expect(
    page.getByRole("checkbox", { name: /내 제목 완료/ })
  ).toBeChecked();
});

test("same-field conflicts offer a manual value choice", async ({ page }) => {
  let loads = 0;
  let saves = 0;
  const latest = {
    ...savedExamplePlan,
    blocks: savedExamplePlan.blocks.map((block, index) =>
      index === 0 ? { ...block, title: "최신 제목" } : block
    ),
  };
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() === "GET") {
      loads++;
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: loads === 1 ? savedExamplePlan : latest,
          revision: loads === 1 ? 1 : 2,
        }),
      });
      return;
    }
    if (route.request().method() === "PUT") {
      saves++;
      await route.fulfill({
        status: saves === 1 ? 409 : 200,
        contentType: "application/json",
        body: JSON.stringify(
          saves === 1
            ? { error: "다른 창에서 계획이 변경되었어요." }
            : { revision: 3 }
        ),
      });
      return;
    }
    await route.fallback();
  });
  await page.goto("/");
  await page
    .getByRole("button", { name: /깊이 집중해서 공부하기 수정/ })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByLabel("할 일").fill("내 제목");
  await editor.getByRole("button", { name: "변경 적용" }).click();
  await page.getByRole("button", { name: "계획 저장" }).click();
  await page.getByRole("button", { name: "내 변경 다시 적용" }).click();
  await expect(page.getByText("충돌한 필드를 어떻게 남길까요?")).toBeVisible();
  await expect(page.getByText("내 변경: 내 제목")).toBeVisible();
  await expect(page.getByText("최신 내용: 최신 제목")).toBeVisible();
  await page.getByRole("button", { name: "내 값 사용" }).click();
  await expect(
    page.getByText("충돌한 변경을 선택해 저장했어요.")
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /내 제목 수정/ })
  ).toBeVisible();
});

test("a date-save conflict keeps recovery actions inside the dialog", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 409,
      contentType: "application/json",
      body: JSON.stringify({ error: "다른 창에서 계획이 변경되었어요." }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "다음 날" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "저장하고 이동" }).click();
  await expect(
    dialog.getByRole("button", { name: "최신 내용 불러오기" })
  ).toBeVisible();
  await expect(
    dialog.getByRole("button", { name: "내 변경 다시 적용" })
  ).toBeVisible();
});

test("reapplying an independent conflict shows a success announcement", async ({
  page,
}) => {
  let saves = 0;
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    saves++;
    await route.fulfill({
      status: saves === 1 ? 409 : 200,
      contentType: "application/json",
      body: JSON.stringify(
        saves === 1
          ? { error: "다른 창에서 계획이 변경되었어요." }
          : { revision: 1 }
      ),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await page.getByRole("button", { name: "내 변경 다시 적용" }).click();
  await expect(page.getByText("변경 내용을 병합해 저장했어요.")).toBeVisible();
});
