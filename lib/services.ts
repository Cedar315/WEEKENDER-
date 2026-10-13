import { Leg, Point } from "./model";
export async function service(body: object, signal?: AbortSignal) {
  const r = await fetch("/api/services", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!r.ok) throw Error("服务请求失败");
  return r.json();
}
export const unknownLeg: Leg = {
  status: "unknown",
  minutes: null,
  path: [],
  source: "尚未验证",
  message: "交通耗时待验证",
};
export async function route(
  from: Point,
  to: Point,
  mode: string,
  signal?: AbortSignal,
  departure?: string,
): Promise<Leg> {
  return service({ action: "route", from, to, mode, departure }, signal);
}

// Seed destinations are in NSW. Resolve daylight saving per date, not a fixed UTC offset.
export function departureISO(
  date: string,
  time: string,
  zone = "Australia/Sydney",
) {
  const base = new Date(`${date}T${time}:00Z`);
  const offset =
    new Intl.DateTimeFormat("en", {
      timeZone: zone,
      timeZoneName: "shortOffset",
    })
      .formatToParts(base)
      .find((x) => x.type === "timeZoneName")?.value || "GMT";
  const m = offset.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const minutes = m
    ? (m[1] === "-" ? -1 : 1) * (Number(m[2]) * 60 + Number(m[3] || 0))
    : 0;
  return new Date(base.getTime() - minutes * 60000).toISOString();
}
