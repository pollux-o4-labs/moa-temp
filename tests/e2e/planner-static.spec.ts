import { expect, test } from "@playwright/test";

test("static hosting keeps anonymous drafts available without an API route", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByText("가볍게, 하나부터 시작해요.")).toBeVisible();

  const quickAdd = page.getByLabel("새 항목");
  await quickAdd.fill("정적 호스트에서 작성한 초안");
  await quickAdd.press("Enter");
  await expect(
    page.getByRole("button", { name: /정적 호스트에서 작성한 초안 수정/ })
  ).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: /정적 호스트에서 작성한 초안 수정/ })
  ).toBeVisible();
});
