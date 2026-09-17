import test from "node:test";
import assert from "node:assert/strict";
import {
  normalizePlannerLocation,
  readPlannerLocation,
  withPlannerLocation,
} from "../features/planner/planner-location.ts";
import { safeRelativeReturnPath } from "../lib/auth-url.ts";

test("planner location reads only supported view values", () => {
  assert.deepEqual(
    readPlannerLocation(
      new URL("http://localhost/?day=2026-09-11&view=timeline")
    ),
    {
      day: "2026-09-11",
      view: "timeline",
      invalidDay: null,
      invalidView: null,
    }
  );
  assert.deepEqual(
    readPlannerLocation(new URL("http://localhost/?view=unknown")),
    { day: null, view: "blocks", invalidDay: null, invalidView: "unknown" }
  );
});

test("planner location rejects invalid dates and normalizes unsupported values", () => {
  const invalid = readPlannerLocation(
    new URL("http://localhost/?day=2024-02-30&view=unknown")
  );
  assert.equal(invalid.day, null);
  assert.equal(invalid.invalidDay, "2024-02-30");
  assert.equal(invalid.invalidView, "unknown");
  const normalized = normalizePlannerLocation(
    new URL("http://localhost/?day=2024-02-30&view=unknown&keep=1"),
    "2026-09-14"
  );
  assert.equal(normalized.search, "?day=2026-09-14&keep=1");
});

test("planner location updates preserve unrelated query parameters", () => {
  const next = withPlannerLocation(
    new URL("http://localhost/?check=location"),
    { day: "2026-09-12", view: "circle" }
  );
  assert.equal(next.search, "?check=location&day=2026-09-12&view=circle");
  assert.equal(
    withPlannerLocation(next, { day: "" }).search,
    "?check=location&view=circle"
  );
});

test("auth return paths preserve deep links but reject external destinations", () => {
  assert.equal(
    safeRelativeReturnPath("/?day=2024-02-28&view=timeline"),
    "/?day=2024-02-28&view=timeline"
  );
  assert.equal(safeRelativeReturnPath("//evil.example"), "/");
  assert.equal(safeRelativeReturnPath("https://evil.example"), "/");
});
