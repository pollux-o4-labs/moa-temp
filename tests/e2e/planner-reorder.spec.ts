import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("grip movement menu reorders without opening the editor", async ({
  page,
}) => {
  await page.goto("/");
  const rows = page.locator("[data-block-id]");
  const before = await rows.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-block-id"))
  );
  await rows.first().locator(".grip-button").press("Enter");
  const menu = page.getByRole("menu");
  await expect(menu).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await menu.getByRole("menuitem", { name: "뒤로" }).click();
  await expect
    .poll(async () =>
      rows.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id"))
      )
    )
    .not.toEqual(before);
});

test("grip click opens the movement menu without opening the editor", async ({
  page,
}) => {
  await page.goto("/");
  await page.locator(".grip-button").first().click();
  await expect(page.getByRole("menu")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
