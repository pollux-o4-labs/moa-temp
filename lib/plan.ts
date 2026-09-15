import { z } from "zod";

export const STORAGE_SCHEMA_VERSION = 2 as const;
export const COLORS = ["blue", "peach", "green", "yellow"] as const;
export const MINUTES_PER_HOUR = 60;
export const MINUTES_PER_DAY = 24 * MINUTES_PER_HOUR;
export const MAX_SCHEDULE_MINUTES = MINUTES_PER_DAY * 2 - 1;
export const PLAN_LIMITS = {
  minBlockMinutes: 5,
  maxBlockMinutes: 720,
  maxTitleLength: 100,
  maxBlocks: 100,
  maxDayMinutes: MINUTES_PER_DAY,
  history: 30,
} as const;

// These values remain available for the legacy demo fixture only. New user
// input never receives these defaults; optional fields are stored as null.
export const CATEGORIES = {
  blue: "집중",
  peach: "일상",
  green: "휴식",
  yellow: "나를 위한 시간",
} as const;

const nullableStartSchema = z
  .number()
  .int("시작 시각은 분 단위 정수로 입력해주세요.")
  .min(0)
  .max(MAX_SCHEDULE_MINUTES)
  .nullable();
const nullableMinutesSchema = z
  .number()
  .int("소요 시간은 분 단위 정수로 입력해주세요.")
  .min(PLAN_LIMITS.minBlockMinutes, "5분 이상 입력해주세요.")
  .max(PLAN_LIMITS.maxBlockMinutes, "720분 이하로 입력해주세요.")
  .nullable();

export const blockSchema = z
  .object({
    id: z.string().min(1).max(80),
    title: z
      .string()
      .trim()
      .min(1, "할 일을 적어주세요.")
      .max(PLAN_LIMITS.maxTitleLength, "100자 이내로 적어주세요."),
    startMinute: nullableStartSchema,
    minutes: nullableMinutesSchema,
    color: z.enum(COLORS).nullable(),
    done: z.boolean(),
  })
  .strict();

const planV2Schema = z
  .object({
    schemaVersion: z.literal(STORAGE_SCHEMA_VERSION),
    start: z
      .number()
      .int()
      .min(0)
      .max(MINUTES_PER_DAY - 1)
      .nullable(),
    blocks: z.array(blockSchema).max(PLAN_LIMITS.maxBlocks),
  })
  .strict()
  .superRefine((plan, ctx) => {
    if (
      new Set(plan.blocks.map((block) => block.id)).size !== plan.blocks.length
    )
      ctx.addIssue({ code: "custom", message: "블록이 중복되었습니다." });
    const specifiedMinutes = plan.blocks.reduce(
      (sum, block) => sum + (block.minutes ?? 0),
      0
    );
    if (specifiedMinutes > PLAN_LIMITS.maxDayMinutes)
      ctx.addIssue({
        code: "custom",
        message: "계획한 시간은 최대 24시간까지 담을 수 있어요.",
      });
  });

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeLegacyInput(value: unknown) {
  if (!isRecord(value)) return value;
  if (value.schemaVersion !== undefined && value.schemaVersion !== 1)
    if (value.schemaVersion !== STORAGE_SCHEMA_VERSION) return value;
  if (!Array.isArray(value.blocks)) return value;
  return {
    ...value,
    schemaVersion: STORAGE_SCHEMA_VERSION,
    blocks: value.blocks.map((block) =>
      isRecord(block)
        ? {
            ...block,
            startMinute: block.startMinute ?? null,
          }
        : block
    ),
  };
}

/** Adds v2 field presence without applying aggregate validation. This is used
 * by merge so an invalid merged total can become a user-visible conflict. */
export function normalizePlanShape(value: unknown): Plan {
  return normalizeLegacyInput(value) as Plan;
}

/**
 * The read schema accepts the unversioned v1 wire shape and returns the v2
 * domain value. Writers use `persistedPlanSchema` so an old client cannot
 * overwrite a v2 record without upgrading first.
 */
export const planSchema = z.preprocess(normalizeLegacyInput, planV2Schema);
export const persistedPlanSchema = planV2Schema;
export type Block = z.infer<typeof blockSchema>;
export type Plan = z.infer<typeof planV2Schema>;
export function createDraftBlock(id: string, title = ""): Block {
  return {
    id,
    title,
    startMinute: null,
    minutes: null,
    color: null,
    done: false,
  };
}

export function decodePlan(value: unknown): Plan {
  return planSchema.parse(value);
}

export function sameBlock(left: Block | undefined, right: Block | undefined) {
  if (!left || !right) return left === right;
  return (
    left.id === right.id &&
    left.title === right.title &&
    left.startMinute === right.startMinute &&
    left.minutes === right.minutes &&
    left.color === right.color &&
    left.done === right.done
  );
}

export function samePlan(left: Plan, right: Plan) {
  const normalizedLeft = decodePlan(left);
  const normalizedRight = decodePlan(right);
  return (
    normalizedLeft.schemaVersion === normalizedRight.schemaVersion &&
    normalizedLeft.start === normalizedRight.start &&
    normalizedLeft.blocks.length === normalizedRight.blocks.length &&
    normalizedLeft.blocks.every((block, index) =>
      sameBlock(block, normalizedRight.blocks[index])
    )
  );
}

export function moveBlock(plan: Plan, id: string, target: number): Plan {
  const from = plan.blocks.findIndex((b) => b.id === id);
  if (
    from < 0 ||
    !Number.isInteger(target) ||
    target < 0 ||
    target >= plan.blocks.length
  )
    throw new Error("옮길 위치를 확인해주세요.");
  const blocks = [...plan.blocks];
  const [block] = blocks.splice(from, 1);
  blocks.splice(target, 0, block);
  return { ...plan, blocks };
}

export function emptyPlan(): Plan {
  return { schemaVersion: STORAGE_SCHEMA_VERSION, start: null, blocks: [] };
}

export function planSummary(plan: Plan) {
  const byColor = Object.fromEntries(
    COLORS.map((color) => [color, 0])
  ) as Record<(typeof COLORS)[number], number>;
  let total = 0;
  let complete = 0;
  for (const block of plan.blocks) {
    if (block.minutes !== null) total += block.minutes;
    if (block.done) complete += 1;
    if (block.color && block.minutes !== null)
      byColor[block.color] += block.minutes;
  }
  return {
    total,
    complete,
    byColor,
    end: plan.start === null ? null : plan.start + total,
  };
}
