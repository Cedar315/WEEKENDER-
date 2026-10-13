import { z } from "zod";
export const pointSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});
export const conditionsSchema = z.object({
  origin: z.string().min(1),
  point: pointSchema,
  days: z.number().int().min(1).max(7),
  date: z.string().date(),
  budget: z.number().positive(),
  currency: z.enum(["AUD", "USD", "CNY"]),
  people: z.number().int().min(1).max(12),
  transport: z.enum(["transit", "drive", "bus", "train", "any"]),
  interests: z.array(z.string()),
  pace: z.enum(["easy", "medium", "full"]),
});
export type Conditions = z.infer<typeof conditionsSchema>;
export type Point = z.infer<typeof pointSchema>;
export const poiSchema = z.object({
  id: z.string(),
  name: z.string(),
  point: pointSchema,
  type: z.string(),
  minutes: z.number().min(15).max(480),
  note: z.string(),
  source: z.string(),
});
export type POI = z.infer<typeof poiSchema>;
export type Destination = {
  id: string;
  name: string;
  english: string;
  point: Point;
  tags: string[];
  description: string;
  image: string;
  pois: POI[];
  stay: string;
  source: string;
};
export type Leg = {
  status: "verified" | "unknown";
  minutes: number | null;
  path: Point[];
  source: string;
  message: string;
};
export const daySchema = z.object({
  id: z.string(),
  start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
  stops: z.array(poiSchema).max(12),
  transport: z.enum(["transit", "drive", "bus", "train", "any"]),
});
export type Day = z.infer<typeof daySchema>;
export const planSchema = z.object({
  version: z.literal(2),
  conditions: conditionsSchema,
  destinationId: z.string(),
  days: z.array(daySchema).min(1).max(7),
  savedAt: z.string(),
});
export type Plan = z.infer<typeof planSchema>;
export function schedule(day: Day, legs: Leg[]) {
  let t =
    Number(day.start.split(":")[0]) * 60 + Number(day.start.split(":")[1]);
  let known = true;
  return day.stops.map((stop, i) => {
    if (i > 0) {
      const leg = legs[i - 1];
      if (leg?.minutes != null && leg.status === "verified") t += leg.minutes;
      else known = false;
    }
    const arrival = known ? t : null;
    t += stop.minutes;
    return { arrival, departure: known ? t : null };
  });
}
export const clock = (n: number | null) =>
  n === null
    ? "时间待验证"
    : `${n >= 1440 ? "次日 " : ""}${String(Math.floor(n / 60) % 24).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
export function draft(c: Conditions, d: Destination): Day[] {
  const max = c.pace === "easy" ? 2 : 3;
  return Array.from({ length: c.days }, (_, i) => ({
    id: `day-${i + 1}`,
    start: i === 0 ? "10:00" : "09:00",
    transport: c.transport,
    stops: d.pois.slice(i * max, (i + 1) * max),
  }));
}
export function budget(c: Conditions) {
  if (c.currency !== "AUD") return null;
  return {
    lodging: [70 * (c.days - 1) * c.people, 130 * (c.days - 1) * c.people],
    food: [25 * c.days * c.people, 45 * c.days * c.people],
  };
}

export function validateCatalogPlan(
  input: unknown,
  catalog: Destination[],
): Plan | null {
  const parsed = planSchema.safeParse(input);
  if (!parsed.success) return null;
  const p = parsed.data,
    d = catalog.find((d) => d.id === p.destinationId);
  if (!d || p.days.length !== p.conditions.days) return null;
  if (
    p.days.some(
      (day) =>
        new Set(day.stops.map((s) => s.id)).size !== day.stops.length ||
        day.stops.some((stop) => {
          const real = d.pois.find((x) => x.id === stop.id);
          return (
            !real ||
            real.name !== stop.name ||
            real.source !== stop.source ||
            real.point.lat !== stop.point.lat ||
            real.point.lng !== stop.point.lng
          );
        }),
    )
  )
    return null;
  return p;
}
