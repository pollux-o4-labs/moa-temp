import { z } from "zod";
import { persistedPlanSchema, planSchema } from "./plan.ts";
import { dateSchema } from "./plan-date.ts";

export const MAX_PLAN_PAYLOAD_BYTES = 60_000;

export const revisionSchema = z.number().int().nonnegative();
export const savePlanSchema = z
  .object({
    day: dateSchema,
    plan: persistedPlanSchema,
    revision: revisionSchema,
  })
  .strict();
export const loadedPlanSchema = z.object({
  plan: planSchema.nullable(),
  revision: revisionSchema,
});
export const savedPlanSchema = z.object({
  revision: revisionSchema.positive(),
});
export type LoadedPlan = z.infer<typeof loadedPlanSchema>;
export type SavePlan = z.infer<typeof savePlanSchema>;
export class PlanRepositoryError extends Error {
  readonly status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "PlanRepositoryError";
  }
}
export interface PlanRepository {
  load(day: string): Promise<LoadedPlan>;
  save(request: SavePlan): Promise<{ revision: number }>;
}
