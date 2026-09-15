import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  moveBlock,
  planSchema,
  sameBlock,
  samePlan,
  CATEGORIES,
  createDraftBlock,
  planSummary,
} from "../lib/plan.ts";
import { demoPlan } from "../lib/plan-fixtures.ts";
import { schedule, timeLabel, durationLabel } from "../lib/plan-schedule.ts";
import { dateSchema, localDate, shiftDate } from "../lib/plan-date.ts";
import { applyPlanCommand } from "../lib/plan-commands.ts";

test("new draft factory keeps optional values unset", () => {
  assert.deepEqual(createDraftBlock("draft", "읽기"), {
    id: "draft",
    title: "읽기",
    startMinute: null,
    minutes: null,
    color: null,
    done: false,
  });
});

test("shopping moves ahead of study and all time slots reflow without changing duration", () => {
  const original = demoPlan();
  const next = moveBlock(original, "shopping", 0);
  const rows = schedule(next);
  assert.deepEqual(
    rows.map((b) => b.id),
    ["shopping", "study", "rest", "journal"]
  );
  assert.deepEqual(
    rows.map((b) => [b.start, b.end]),
    [
      [540, 600],
      [600, 720],
      [720, 780],
      [780, 810],
    ]
  );
  assert.deepEqual(
    original.blocks.map((b) => b.id),
    ["study", "shopping", "rest", "journal"]
  );
  assert.equal(rows.at(-1).end, schedule(original).at(-1).end);
});
test("reordering in both directions preserves each block exactly once", () => {
  const plan = demoPlan();
  for (const block of plan.blocks)
    for (let index = 0; index < plan.blocks.length; index++) {
      const moved = moveBlock(plan, block.id, index);
      assert.equal(moved.blocks[index].id, block.id);
      assert.deepEqual(
        [...moved.blocks].sort((a, b) => a.id.localeCompare(b.id)),
        [...plan.blocks].sort((a, b) => a.id.localeCompare(b.id))
      );
      const rows = schedule(moved);
      rows.slice(1).forEach((row, i) => assert.equal(row.start, rows[i].end));
    }
});
test("duration and start edits reflow across midnight with explicit next-day labels", () => {
  const plan = demoPlan();
  plan.start = 1380;
  plan.blocks[0].minutes = 90;
  const rows = schedule(plan);
  assert.equal(timeLabel(rows[0].end), "다음 날 00:30");
  assert.equal(rows[1].start, 1470);
  assert.equal(timeLabel(1440), "다음 날 00:00");
});
test("invalid and duplicate blocks, excessive totals, impossible dates and invalid positions are rejected", () => {
  const plan = demoPlan();
  assert.equal(
    planSchema.safeParse({ ...plan, blocks: [...plan.blocks, plan.blocks[0]] })
      .success,
    false
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], minutes: 0 }],
    }).success,
    false
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], title: "   " }],
    }).success,
    false
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: plan.blocks.map((b) => ({ ...b, minutes: 720 })),
    }).success,
    false
  );
  assert.throws(() => moveBlock(plan, "missing", 0));
  assert.throws(() => moveBlock(plan, "study", -1));
  assert.equal(dateSchema.safeParse("2026-02-30").success, false);
  assert.equal(dateSchema.safeParse("2028-02-29").success, true);
  assert.equal(planSchema.safeParse({ start: 0, blocks: [] }).success, true);
  assert.equal(planSchema.safeParse({ ...plan, start: 1_439 }).success, true);
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: plan.blocks.map((block) => ({ ...block, minutes: 360 })),
    }).success,
    true
  );
  assert.equal(planSchema.safeParse({ ...plan, start: 1_440 }).success, false);
  assert.equal(
    planSchema
      .safeParse({ ...plan, blocks: [plan.blocks[0], plan.blocks[0]] })
      .error.issues.at(-1).message,
    "블록이 중복되었습니다."
  );
  assert.equal(
    planSchema
      .safeParse({
        ...plan,
        blocks: plan.blocks.map((block) => ({ ...block, minutes: 400 })),
      })
      .error.issues.at(-1).message,
    "계획한 시간은 최대 24시간까지 담을 수 있어요."
  );
  assert.equal(
    planSchema.safeParse({ ...plan, start: 1_440 }).error.issues[0].code,
    "too_big"
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], title: "" }],
    }).error.issues[0].message,
    "할 일을 적어주세요."
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], title: "x".repeat(101) }],
    }).error.issues[0].message,
    "100자 이내로 적어주세요."
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], minutes: 721 }],
    }).error.issues[0].message,
    "720분 이하로 입력해주세요."
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], minutes: 4.5 }],
    }).error.issues[0].message,
    "소요 시간은 분 단위 정수로 입력해주세요."
  );
  assert.equal(
    planSchema.safeParse({
      ...plan,
      blocks: [{ ...plan.blocks[0], minutes: 4 }],
    }).error.issues[0].message,
    "5분 이상 입력해주세요."
  );
  assert.equal(
    planSchema.safeParse({ ...plan, blocks: [{ ...plan.blocks[0], id: "" }] })
      .success,
    false
  );
  assert.equal(dateSchema.safeParse("x2028-02-29").success, false);
  assert.equal(dateSchema.safeParse("2028-02-29x").success, false);
});
test("plan equality compares domain values independently of object identity or key order", () => {
  const plan = demoPlan();
  const copy = structuredClone(plan);
  assert.equal(sameBlock(plan.blocks[0], copy.blocks[0]), true);
  assert.equal(samePlan(plan, copy), true);
  assert.equal(samePlan(plan, { ...copy, start: copy.start + 1 }), false);
  assert.equal(
    samePlan(plan, { ...copy, blocks: [...copy.blocks].reverse() }),
    false
  );
  assert.equal(
    sameBlock(plan.blocks[0], { ...copy.blocks[0], done: true }),
    false
  );
  assert.equal(sameBlock(undefined, undefined), true);
  assert.equal(sameBlock(undefined, plan.blocks[0]), false);
  assert.equal(sameBlock(plan.blocks[0], undefined), false);
  for (const field of ["id", "title", "minutes", "color", "done"]) {
    const changed = { ...copy.blocks[0] };
    changed[field] =
      field === "id"
        ? "other"
        : field === "title"
          ? "other title"
          : field === "minutes"
            ? 60
            : field === "color"
              ? "peach"
              : true;
    assert.equal(sameBlock(plan.blocks[0], changed), false, field);
  }
  assert.equal(samePlan(plan, { ...copy, blocks: [] }), false);
  assert.equal(
    samePlan(plan, { ...copy, blocks: copy.blocks.slice(0, -1) }),
    false
  );
  assert.equal(
    samePlan(plan, {
      ...copy,
      blocks: [...copy.blocks, { ...copy.blocks[0], id: "extra" }],
    }),
    false
  );
  assert.equal(
    samePlan(plan, {
      ...copy,
      blocks: copy.blocks.map((b) => ({ ...b, title: "changed" })),
    }),
    false
  );
});

test("all plan commands preserve the aggregate contract", () => {
  const plan = demoPlan();
  const replacement = { ...plan.blocks[0], title: "바꾼 제목", minutes: 60 };
  const added = {
    id: "new",
    title: "새 블록",
    minutes: 5,
    color: "yellow",
    done: false,
  };
  const upserted = applyPlanCommand(plan, {
    type: "upsert",
    block: replacement,
  });
  assert.equal(upserted.blocks.length, plan.blocks.length);
  assert.deepEqual(upserted.blocks[0], replacement);
  const insertedAtEnd = applyPlanCommand(plan, {
    type: "upsert",
    block: added,
  });
  const inserted = applyPlanCommand(insertedAtEnd, {
    type: "reorder",
    id: added.id,
    target: 0,
  });
  assert.deepEqual(inserted.blocks[0], { ...added, startMinute: null });
  assert.equal(inserted.blocks.length, plan.blocks.length + 1);
  const removed = applyPlanCommand(plan, { type: "remove", id: "study" });
  assert.equal(
    removed.blocks.some((block) => block.id === "study"),
    false
  );
  assert.equal(removed.blocks.length, plan.blocks.length - 1);
  const completed = applyPlanCommand(plan, {
    type: "complete",
    id: "study",
    done: true,
  });
  assert.equal(
    completed.blocks.find((block) => block.id === "study").done,
    true
  );
  assert.equal(
    completed.blocks.find((block) => block.id === "shopping").done,
    false
  );
  assert.equal(
    completed.blocks.find((block) => block.id === "rest").done,
    false
  );
  const started = applyPlanCommand(plan, { type: "start", minutes: 1_000 });
  assert.equal(started.start, 1_000);
  assert.deepEqual(started.blocks, plan.blocks);
  assert.throws(
    () => moveBlock(plan, "study", plan.blocks.length),
    /옮길 위치/
  );
});

test("labels, dates and category names cover their boundary values", () => {
  assert.deepEqual(CATEGORIES, {
    blue: "집중",
    peach: "일상",
    green: "휴식",
    yellow: "나를 위한 시간",
  });
  assert.equal(timeLabel(0), "00:00");
  assert.equal(timeLabel(1), "00:01");
  assert.equal(timeLabel(1_440), "다음 날 00:00");
  assert.equal(durationLabel(0), "0분");
  assert.equal(durationLabel(1), "1분");
  assert.equal(durationLabel(60), "1시간");
  assert.equal(durationLabel(61), "1시간 1분");
  assert.equal(
    planSummary({
      start: 0,
      blocks: [{ ...demoPlan().blocks[0], done: true }],
    }).complete,
    1
  );
  const date = new Date(2026, 0, 2, 3, 4, 5);
  assert.equal(localDate(date), "2026-01-02");
  assert.equal(shiftDate("2026-01-31", 1), "2026-02-01");
  assert.equal(shiftDate("2026-01-01", -1), "2025-12-31");
  const pacificDate = execFileSync(
    process.execPath,
    [
      "--experimental-strip-types",
      "--input-type=module",
      "-e",
      'import { shiftDate } from "./lib/plan-date.ts"; console.log(shiftDate("2026-01-01", 0));',
    ],
    { env: { ...process.env, TZ: "America/Los_Angeles" }, encoding: "utf8" }
  );
  assert.equal(pacificDate.trim(), "2026-01-01");
});
