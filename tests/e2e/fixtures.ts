import type { Page } from "@playwright/test";

export const savedExamplePlan = {
  start: 540,
  blocks: [
    {
      id: "study",
      title: "깊이 집중해서 공부하기",
      minutes: 120,
      color: "blue",
      done: false,
    },
    {
      id: "shopping",
      title: "친구와 장보기",
      minutes: 60,
      color: "peach",
      done: false,
    },
    {
      id: "rest",
      title: "점심 먹고 잠깐 쉬기",
      minutes: 60,
      color: "green",
      done: false,
    },
    {
      id: "journal",
      title: "오늘의 생각, 일기 쓰기",
      minutes: 30,
      color: "yellow",
      done: false,
    },
  ],
} as const;

export async function mockSavedExamplePlan(page: Page) {
  await page.route("**/api/plans**", async (route) => {
    if (route.request().method() !== "GET") return route.fallback();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ plan: savedExamplePlan, revision: 0 }),
    });
  });
}
