import { test } from "node:test";
import assert from "node:assert/strict";
import { defaultConditions, destinations } from "../lib/data";
import {
  draft,
  schedule,
  planSchema,
  conditionsSchema,
  budget,
  Leg,
} from "../lib/model";
import { departureISO } from "../lib/services";
const verified = (minutes: number): Leg => ({
  status: "verified",
  minutes,
  path: [],
  source: "test",
  message: "",
});
test("two-day plan uses real POIs and survives storage roundtrip", () => {
  const days = draft(defaultConditions, destinations[0]);
  assert.equal(days.length, 2);
  assert.ok(days.every((d) => d.stops.length > 0));
  const p = {
    version: 2,
    conditions: defaultConditions,
    destinationId: "blue-mountains",
    days,
    savedAt: new Date().toISOString(),
  };
  assert.deepEqual(planSchema.parse(JSON.parse(JSON.stringify(p))), p);
});
test("deleting a stop recalculates from the new adjacent route, not old route duration", () => {
  const day = {
    ...draft({ ...defaultConditions, pace: "full" }, destinations[0])[0],
    start: "09:00",
  };
  const before = schedule(day, [verified(20), verified(30)]);
  const after = schedule({ ...day, stops: [day.stops[0], day.stops[2]] }, [
    verified(12),
  ]);
  assert.equal(before[2].arrival, 800);
  assert.equal(after[1].arrival, 642);
});
test("unknown transport invalidates downstream arrival times", () => {
  const day = draft({ ...defaultConditions, pace: "full" }, destinations[0])[0];
  const result = schedule(day, [
    { status: "unknown", minutes: null, path: [], source: "", message: "" },
    verified(10),
  ]);
  assert.equal(result[0].arrival, 600);
  assert.equal(result[1].arrival, null);
  assert.equal(result[2].arrival, null);
});
test("changing stop duration shifts later arrivals", () => {
  const day = draft(defaultConditions, destinations[0])[0];
  const a = schedule(day, [verified(15)]);
  const b = schedule(
    {
      ...day,
      stops: day.stops.map((p, i) =>
        i === 0 ? { ...p, minutes: p.minutes + 30 } : p,
      ),
    },
    [verified(15)],
  );
  assert.equal(b[1].arrival! - a[1].arrival!, 30);
});
test("invalid AI / stored shape and impossible conditions rejected", () => {
  assert.equal(
    planSchema.safeParse({ days: [{ stops: ["imaginary"] }] }).success,
    false,
  );
  assert.equal(
    conditionsSchema.safeParse({ ...defaultConditions, days: 0, budget: -1 })
      .success,
    false,
  );
});
test("budget assumptions scale by people and nights; currencies not silently converted", () => {
  assert.deepEqual(
    budget({ ...defaultConditions, people: 2 })?.lodging,
    [140, 260],
  );
  assert.equal(budget({ ...defaultConditions, currency: "CNY" }), null);
});
test("Sydney route timestamps respect daylight saving", () => {
  assert.equal(departureISO("2026-10-17", "08:00"), "2026-10-16T21:00:00.000Z");
  assert.equal(departureISO("2026-07-17", "08:00"), "2026-07-16T22:00:00.000Z");
});
