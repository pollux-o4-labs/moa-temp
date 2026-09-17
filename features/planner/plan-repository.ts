import {
  loadedPlanSchema,
  savedPlanSchema,
  PlanRepositoryError,
  type PlanRepository,
} from "@/lib/plan-contract";
import { APP_ROUTES } from "@/lib/app-routes";

const REQUEST_TIMEOUT_MS = 5_000;

async function request(url: string, options?: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(url, {
        ...options,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new PlanRepositoryError(
          "요청 시간이 초과됐어요. 다시 시도해주세요.",
          408
        );
      }
      throw new PlanRepositoryError(
        "인터넷 연결을 확인한 뒤 다시 시도해주세요.",
        0
      );
    }
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      if (controller.signal.aborted) {
        throw new PlanRepositoryError(
          "요청 시간이 초과됐어요. 다시 시도해주세요.",
          408
        );
      }
      throw new PlanRepositoryError(
        response.ok
          ? "서버 응답 형식을 확인해주세요."
          : "요청을 처리하지 못했어요.",
        response.status || 502
      );
    }
    if (!response.ok) {
      const message =
        body &&
        typeof body === "object" &&
        "error" in body &&
        typeof body.error === "string"
          ? body.error
          : "요청을 처리하지 못했어요.";
      throw new PlanRepositoryError(message, response.status);
    }
    return body;
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseLoaded(body: unknown) {
  const parsed = loadedPlanSchema.safeParse(body);
  if (!parsed.success)
    throw new PlanRepositoryError("서버 응답 형식을 확인해주세요.", 502);
  return parsed.data;
}

function parseSaved(body: unknown) {
  const parsed = savedPlanSchema.safeParse(body);
  if (!parsed.success)
    throw new PlanRepositoryError("서버 응답 형식을 확인해주세요.", 502);
  return parsed.data;
}

export const httpPlanRepository: PlanRepository = {
  async load(day) {
    return parseLoaded(
      await request(`${APP_ROUTES.plansApi}?day=${encodeURIComponent(day)}`, {
        cache: "no-store",
      })
    );
  },
  async save(payload) {
    return parseSaved(
      await request(APP_ROUTES.plansApi, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })
    );
  },
};
