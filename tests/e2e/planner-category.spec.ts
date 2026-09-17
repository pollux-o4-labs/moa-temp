import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("basic view reflects a changed category icon without showing its label", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", { name: /오늘의 생각, 일기 쓰기 수정/ })
    .click();
  const editor = page.getByRole("dialog");
  await editor.getByRole("radio", { name: "휴식" }).click();
  await editor.getByRole("button", { name: "변경 적용" }).click();

  const block = page.locator('[data-block-id="journal"]');
  await expect(block.locator(".category")).toHaveCount(0);
  await expect(block.locator(".clay-block")).toHaveClass(/neutral/);
  await expect(block.locator(".block-icon svg")).toHaveClass(/lucide-coffee/);
});
