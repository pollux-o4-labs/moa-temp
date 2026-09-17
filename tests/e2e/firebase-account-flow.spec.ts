import { expect, test, type Page } from "@playwright/test";

const password = "emulator-test-password-123";

async function signIn(page: Page, email: string) {
  await page.evaluate(
    async ({ email: userEmail, password: userPassword }) => {
      for (let attempt = 0; attempt < 40; attempt += 1) {
        if (window.__MOA_E2E_AUTH__) {
          await window.__MOA_E2E_AUTH__.signIn(userEmail, userPassword);
          return;
        }
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      throw new Error("emulator auth controls are not installed");
    },
    { email, password }
  );
  await expect(page.getByRole("button", { name: "로그아웃" })).toBeVisible();
}

async function signOut(page: Page) {
  await page.evaluate(() => window.__MOA_E2E_AUTH__?.signOut());
  await expect(
    page.getByRole("button", { name: "Google로 로그인" })
  ).toBeVisible();
}

test.afterEach(async () => {
  await Promise.all([
    fetch("http://127.0.0.1:9099/emulator/v1/projects/timep-tp/accounts", {
      method: "DELETE",
    }),
    fetch(
      "http://127.0.0.1:8080/emulator/v1/projects/timep-tp/databases/(default)/documents",
      { method: "DELETE" }
    ),
  ]);
});

test("authenticated plans remain isolated across account sessions", async ({
  page,
}) => {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const emailA = `account-a-${suffix}@example.com`;
  const emailB = `account-b-${suffix}@example.com`;

  await page.goto("/");
  await signIn(page, emailA);

  await page.getByLabel("새 항목").fill("계정 A의 계획");
  await page.getByRole("button", { name: "추가" }).click();
  await expect(
    page.getByRole("button", { name: "계정 A의 계획 수정" })
  ).toBeVisible();
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();

  await page.reload();
  await expect(
    page.getByRole("button", { name: "계정 A의 계획 수정" })
  ).toBeVisible();

  await signOut(page);
  await signIn(page, emailB);
  await expect(
    page.getByRole("button", { name: "계정 A의 계획 수정" })
  ).toHaveCount(0);

  await page.getByLabel("새 항목").fill("계정 B의 계획");
  await page.getByRole("button", { name: "추가" }).click();
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();

  await signOut(page);
  await signIn(page, emailA);
  await expect(
    page.getByRole("button", { name: "계정 A의 계획 수정" })
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "계정 B의 계획 수정" })
  ).toHaveCount(0);
});
