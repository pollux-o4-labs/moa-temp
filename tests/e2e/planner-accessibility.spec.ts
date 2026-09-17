import { expect, test } from "@playwright/test";
import { mockSavedExamplePlan } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await mockSavedExamplePlan(page);
});

test("planner exposes consistent names, states, landmarks, and list roles", async ({
  page,
}) => {
  await page.goto("/");

  await expect(
    page.locator("section.planner").getByRole("heading", {
      level: 2,
      name: "오늘의 계획",
    })
  ).toBeAttached();
  await expect(page.locator("section.overview")).toHaveCount(0);
  await expect(page.locator(".block-copy h3")).toHaveCount(0);

  const list = page.getByRole("list", { name: "계획 블록" });
  const directChildren = list.locator(":scope > *");
  await expect(directChildren).toHaveCount(5);
  expect(
    await directChildren.evaluateAll((items) =>
      items.every((item) => item.getAttribute("role") === "listitem")
    )
  ).toBe(true);
  await expect(list.getByRole("listitem").first()).toHaveAttribute(
    "aria-label",
    "깊이 집중해서 공부하기, 미완료"
  );
  await expect(
    page.getByRole("button", {
      name: "깊이 집중해서 공부하기 수정, 미완료",
    })
  ).toBeVisible();
  await expect(page.locator(".block-list .category")).toHaveCount(0);
  await expect(
    page.locator(".block-list .clay-block:not(.neutral)")
  ).toHaveCount(0);
  await expect(page.locator("[data-react-aria-top-layer]")).toHaveAttribute(
    "aria-label",
    "알림"
  );
});

test("editor exposes quick duration and color selection states", async ({
  page,
}) => {
  await page.goto("/?view=timeline");
  await page.getByRole("button", { name: "새 블록" }).click();
  const editor = page.getByRole("dialog");
  const durations = editor.getByRole("group", {
    name: "빠른 소요 시간 선택",
  });
  const oneHour = durations.getByRole("button", { name: "1시간" });
  await expect(oneHour).toHaveAttribute("aria-pressed", "false");
  await oneHour.click();
  await expect(oneHour).toHaveAttribute("aria-pressed", "true");
  await expect(
    editor.getByRole("radiogroup", { name: "블록의 종류" })
  ).toBeVisible();
});

test("responsive layout preserves labels, targets, and content width", async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 740 });
  await page.goto("/");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  await expect(page.locator(".start-time span")).toBeVisible();
  await expect(page.locator(".date-picker label span")).toContainText(
    /\d{4}년/
  );
  await expect(page.locator(".date-row")).toHaveCSS("position", "sticky");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth
    )
  ).toBeLessThanOrEqual(1);
  const targetSizes = await page
    .locator(
      ".date-picker > button, .grip-button, .duration, .done-check, .start-time input"
    )
    .evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return { width: rect.width, height: rect.height };
      })
    );
  expect(targetSizes.length).toBeGreaterThan(0);
  expect(
    targetSizes.every(({ width, height }) => width >= 44 && height >= 44)
  ).toBe(true);

  await page.getByRole("tab", { name: "원형" }).click();
  await expect(page.locator(".compact-list .category").first()).toBeVisible();

  await page.setViewportSize({ width: 801, height: 900 });
  await expect(page.locator(".planner")).toHaveCSS(
    "grid-template-columns",
    /px$/
  );
  await expect(page.locator(".start-time span")).toBeVisible();
  await page.setViewportSize({ width: 768, height: 1024 });
  await expect(page.locator(".page-title h1")).toHaveCSS(
    "white-space",
    "nowrap"
  );
});

test("pointer dragging exposes a movable preview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  const grip = page.locator(".grip-button").first();
  const box = await grip.boundingBox();
  expect(box).not.toBeNull();
  if (!box) return;
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x, y + 24);
  await expect(page.locator(".drag-preview-layer")).toBeVisible();
  await page.mouse.up();
  await expect(page.locator(".drag-preview-layer")).toHaveCount(0);
});

test("core schedule text keeps readable contrast", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  const ratios = await page.evaluate(() => {
    function rgb(value: string) {
      return value
        .match(/\d+(?:\.\d+)?/g)!
        .slice(0, 3)
        .map(Number);
    }
    function luminance(value: string) {
      return rgb(value)
        .map((channel) => channel / 255)
        .map((channel) =>
          channel <= 0.03928
            ? channel / 12.92
            : ((channel + 0.055) / 1.055) ** 2.4
        )
        .reduce(
          (sum, channel, index) =>
            sum + channel * [0.2126, 0.7152, 0.0722][index],
          0
        );
    }
    function contrast(foreground: string, background: string) {
      const foregroundLuminance = luminance(foreground);
      const backgroundLuminance = luminance(background);
      return (
        (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
        (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
      );
    }
    const white = "rgb(255, 255, 255)";
    return [
      contrast(
        getComputedStyle(document.querySelector(".time-label")!).color,
        white
      ),
      ...Array.from(document.querySelectorAll(".clay-block")).map((block) =>
        contrast(
          getComputedStyle(block.querySelector(".block-title")!).color,
          getComputedStyle(block).backgroundColor
        )
      ),
    ];
  });
  expect(ratios.every((ratio) => ratio >= 4.5)).toBe(true);
});

test("mobile toast leaves the last schedule target unobscured", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-block-id]").last()).toBeVisible();
  await page.locator(".grip-button").first().press("ArrowDown");
  const toast = page.locator("[data-sonner-toast]").first();
  await expect(toast).toBeVisible();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const separation = await page.evaluate(() => {
    const cards = document.querySelectorAll("[data-block-id]");
    const card = cards[cards.length - 1];
    const notice = document.querySelector("[data-sonner-toast]");
    if (!card || !notice) return false;
    const cardRect = card.getBoundingClientRect();
    const toastRect = notice.getBoundingClientRect();
    return toastRect.top >= cardRect.bottom || cardRect.top >= toastRect.bottom;
  });
  expect(separation).toBe(true);
});

test("forced colors keep legend categories distinguishable", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "원형" }).click();
  await page.emulateMedia({ forcedColors: "active" });
  const borderStyles = await page
    .locator(".overview .dot")
    .evaluateAll((dots) =>
      dots.map((dot) => getComputedStyle(dot).borderStyle)
    );
  expect(borderStyles).toEqual(["solid", "dashed", "dotted", "double"]);
});

test("short circle segments remain visible with an exact list fallback", async ({
  page,
}) => {
  await page.unrouteAll();
  await page.route("**/api/plans**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: {
          start: 0,
          blocks: [
            {
              id: "short",
              title: "짧은 블록",
              minutes: 5,
              color: "blue",
              done: false,
            },
            {
              id: "long",
              title: "긴 블록",
              minutes: 720,
              color: "green",
              done: false,
            },
            {
              id: "longer",
              title: "긴 블록 이어서",
              minutes: 715,
              color: "yellow",
              done: false,
            },
          ],
        },
        revision: 1,
      }),
    });
  });
  await page.goto("/");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  await page.getByRole("tab", { name: "원형" }).click();
  await expect(
    page.locator(".circle-surface .ring-segment").first()
  ).toHaveAttribute("stroke-dasharray", /^1\.2/);
  await expect(
    page.getByText("정확한 내용은 아래 목록에서 확인하세요.")
  ).toBeVisible();
});

test("cross-midnight timeline labels stay in one readable unit", async ({
  page,
}) => {
  await page.unrouteAll();
  await page.route("**/api/plans**", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        plan: {
          start: 1380,
          blocks: [
            {
              id: "late",
              title: "늦은 작업",
              minutes: 30,
              color: "blue",
              done: false,
            },
            {
              id: "past-midnight",
              title: "자정 작업",
              minutes: 30,
              color: "green",
              done: false,
            },
          ],
        },
        revision: 1,
      }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-block-id]").first()).toBeVisible();
  await page.getByRole("tab", { name: "타임라인" }).click();
  await expect(
    page.locator(".timeline-list .time-label small").last()
  ).toHaveText("다음 날 00:00");
  await expect(page.locator(".timeline-list .time-label").last()).toHaveCSS(
    "white-space",
    "nowrap"
  );
});
