import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("save errors stay in the page recovery banner, not the editor form", async ({
  page,
}) => {
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    await route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ error: "저장하지 못했어요." }),
    });
  });
  await page.goto("/");
  await page.getByLabel("하루 시작 시간").fill("10:30");
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("alert")).toContainText("저장하지 못했어요.");
  await page
    .getByRole("button", { name: /깊이 집중해서 공부하기 수정/ })
    .click();
  await expect(page.getByRole("dialog").getByRole("alert")).toHaveCount(0);
});

test("planner reorders a block with its keyboard input adapter", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const rows = page.locator("[data-block-id]");
  const before = await rows.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-block-id"))
  );
  const first = rows.first();
  await first.getByRole("button", { name: /순서 이동/ }).press("ArrowDown");
  await expect
    .poll(async () =>
      rows.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-block-id"))
      )
    )
    .not.toEqual(before);
});

test("quick title entry keeps optional values empty through save", async ({
  page,
}) => {
  let savedPayload: {
    plan: {
      blocks: Array<{
        title: string;
        startMinute: number | null;
        minutes: number | null;
        color: string | null;
      }>;
    };
  } = { plan: { blocks: [] } };
  await page.route("**/api/plans", async (route) => {
    if (route.request().method() !== "PUT") return route.fallback();
    savedPayload = JSON.parse(route.request().postData() ?? "{}");
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ revision: 1 }),
    });
  });
  await page.goto("/");
  const quickAdd = page.getByLabel("새 항목");
  await quickAdd.fill("산책하기");
  await quickAdd.press("Enter");
  await expect(
    page.getByRole("button", { name: /산책하기 수정/ })
  ).toBeVisible();
  await page.getByRole("button", { name: "계획 저장" }).click();
  await expect(page.getByRole("button", { name: "저장됨" })).toBeVisible();
  const created = savedPayload.plan.blocks.find(
    (block: { title: string }) => block.title === "산책하기"
  );
  expect(created).toMatchObject({
    startMinute: null,
    minutes: null,
    color: null,
  });
});

test("title entry keeps timeline fields out of the basic editor", async ({
  page,
}) => {
  await page.goto("/");
  const quickAdd = page.getByLabel("새 항목");
  await quickAdd.fill("산책하기");
  await quickAdd.press("Enter");
  const notice = page
    .locator("[data-sonner-toast]")
    .filter({ hasText: "항목을 추가했어요" });
  await expect(notice.getByRole("button", { name: "세부 설정" })).toHaveCount(
    0
  );
  await page.getByRole("button", { name: /산책하기 수정/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(
    dialog.getByRole("heading", { name: "블록 다듬기" })
  ).toBeVisible();
  await expect(dialog.locator("#block-title")).toHaveValue("산책하기");
  await expect(dialog.locator("#block-start-time")).toHaveCount(0);
  await expect(dialog.locator("#block-minutes")).toHaveCount(0);
  await expect(
    dialog.getByRole("group", { name: "빠른 소요 시간 선택" })
  ).toHaveCount(0);
  await expect(
    dialog.getByRole("radiogroup", { name: "블록의 종류" })
  ).toBeVisible();
});

test("timeline is the entry point for adding optional details", async ({
  page,
}) => {
  await page.goto("/?view=timeline");
  await page.getByRole("button", { name: "새 블록" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#block-start-time")).toBeVisible();
  await expect(dialog.locator("#block-minutes")).toBeVisible();
  await expect(
    dialog.getByRole("radiogroup", { name: "블록의 종류" })
  ).toBeVisible();
});

test("timeline values become editable details in the basic view", async ({
  page,
}) => {
  await page.unrouteAll();
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: {
          start: null,
          blocks: [
            {
              id: "bare",
              title: "시간을 정할 항목",
              startMinute: null,
              minutes: null,
              color: null,
              done: false,
            },
          ],
        },
        revision: 1,
      }),
    });
  });
  await page.goto("/?view=blocks");
  await page.getByRole("button", { name: /시간을 정할 항목 수정/ }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog.locator("#block-start-time")).toHaveCount(0);
  await expect(dialog.locator("#block-minutes")).toHaveCount(0);
  await expect(
    dialog.getByRole("radiogroup", { name: "블록의 종류" })
  ).toBeVisible();
  await dialog.getByRole("button", { name: "닫기" }).click();

  await page.getByRole("tab", { name: "타임라인" }).click();
  await page.getByRole("button", { name: /시간을 정할 항목 수정/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator("#block-start-time")).toBeVisible();
  await expect(dialog.locator("#block-minutes")).toBeVisible();
  await dialog.locator("#block-start-time").fill("09:00");
  await dialog.locator("#block-minutes").fill("30");
  await dialog.getByRole("button", { name: "변경 적용" }).click();

  await page.getByRole("tab", { name: "블록" }).click();
  await page.getByRole("button", { name: /시간을 정할 항목 수정/ }).click();
  dialog = page.getByRole("dialog");
  await expect(dialog.locator("#block-start-time")).toHaveValue("09:00");
  await expect(dialog.locator("#block-minutes")).toHaveValue("30");
});

test("configured optional details remain editable from the basic view", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("button", {
      name: /깊이 집중해서 공부하기 수정/,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("#block-start-time")).toHaveCount(0);
  await expect(dialog.locator("#block-minutes")).toHaveValue("120");
  await expect(
    dialog.getByRole("radiogroup", { name: "블록의 종류" })
  ).toBeVisible();
});

test("editor keeps keyboard focus on the edited block after applying", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await edit.focus();
  await edit.press("Enter");
  const editor = page.getByRole("dialog");
  await editor.getByLabel("할 일").fill("키보드 작업");
  await editor.getByRole("button", { name: "변경 적용" }).press("Enter");
  await expect(
    page.getByRole("button", { name: /키보드 작업 수정/ })
  ).toBeFocused();
});

test("editor sends invalid form focus back to the invalid field", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const add = page.getByRole("button", { name: "새 블록" });
  await add.focus();
  await add.press("Enter");
  const editor = page.getByRole("dialog");
  await editor.getByRole("button", { name: "블록 추가" }).press("Enter");
  await expect(editor.locator("#block-title")).toBeFocused();
  await expect(editor.locator("#block-title")).toHaveAttribute(
    "aria-invalid",
    "true"
  );
  await expect(editor.locator("#block-title")).toHaveAttribute(
    "aria-describedby",
    "block-editor-error"
  );
});

test("editor close confirmation keeps focus in the edit workflow", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await edit.focus();
  await edit.press("Enter");
  const editor = page.getByRole("dialog");
  await editor.getByLabel("할 일").fill("아직 적용하지 않음");
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("alertdialog").getByRole("button", { name: "계속 편집" })
  ).toBeVisible();
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "계속 편집" })
    .click();
  await expect(editor.getByLabel("할 일")).toBeFocused();
  await page.keyboard.press("Escape");
  await page
    .getByRole("alertdialog")
    .getByRole("button", { name: "변경 버리고 닫기" })
    .click();
  await expect(edit).toBeFocused();
});

test("deleting a block moves focus to the next stable list control", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await edit.focus();
  await edit.press("Enter");
  await page.getByRole("dialog").getByRole("button", { name: "삭제" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: /친구와 장보기 순서 이동/ })
  ).toBeFocused();
});

test("color radio arrows update the selected value immediately", async ({
  page,
}) => {
  await page.goto("/?view=timeline");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  await page.getByRole("button", { name: "새 블록" }).click();
  const editor = page.getByRole("dialog");
  const focusedColor = editor.getByRole("radio", { name: "집중" });
  await focusedColor.focus();
  await focusedColor.press("ArrowRight");
  await expect(editor.getByRole("radio", { name: "일상" })).toBeChecked();
});

test("field entry points and date navigation preserve keyboard context", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  const edit = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 수정/,
  });
  await expect(page.locator("[data-block-id] .duration")).toHaveCount(0);
  await edit.focus();
  await edit.press("Enter");
  await expect(page.getByRole("dialog").locator("#block-title")).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("tab", { name: "타임라인" }).click();
  const duration = page.getByRole("button", {
    name: /깊이 집중해서 공부하기 소요 시간 수정/,
  });
  await duration.focus();
  await duration.press("Enter");
  await expect(
    page.getByRole("dialog").locator("#block-minutes")
  ).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const next = page.getByRole("button", { name: "다음 날" });
  await next.focus();
  await next.press("Enter");
  await expect(next).toBeFocused();
});

test("last undo returns focus to the working control", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByLabel("하루 시작 시간")).toBeEnabled();
  await page.getByLabel("하루 시작 시간").fill("10:30");
  const undo = page.getByRole("button", { name: "되돌리기" });
  await undo.focus();
  await undo.press("Enter");
  await expect(undo).toBeDisabled();
  await expect(page.getByLabel("하루 시작 시간")).toBeFocused();
});
