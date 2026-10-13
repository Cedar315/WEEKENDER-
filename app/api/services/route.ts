import { NextResponse } from "next/server";
import { z } from "zod";
import { pointSchema } from "@/lib/model";
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("geocode"), query: z.string().min(2).max(160) }),
  z.object({
    action: z.literal("weather"),
    point: pointSchema,
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    action: z.literal("route"),
    from: pointSchema,
    to: pointSchema,
    mode: z.enum(["transit", "drive", "bus", "train", "any"]),
    departure: z.string().datetime().optional(),
  }),
]);
const unknown = (message: string) =>
  NextResponse.json({
    status: "unknown",
    minutes: null,
    path: [],
    source: "无可用路线数据",
    message,
  });
export async function POST(req: Request) {
  try {
    const parsed = schema.safeParse(await req.json());
    if (!parsed.success)
      return NextResponse.json({ error: "请求参数无效" }, { status: 400 });
    const p = parsed.data;
    if (p.action === "geocode") {
      const r = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&limit=5&q=${encodeURIComponent(p.query)}`,
        {
          headers: { "User-Agent": "WeekenderMVP/2.0 (local travel planner)" },
          signal: AbortSignal.timeout(8000),
        },
      );
      if (!r.ok) throw Error();
      const rows = await r.json();
      return NextResponse.json({
        results: rows.map(
          (x: { display_name: string; lat: string; lon: string }) => ({
            name: x.display_name,
            point: { lat: Number(x.lat), lng: Number(x.lon) },
          }),
        ),
        source: "OpenStreetMap Nominatim",
      });
    }
    if (p.action === "weather") {
      const r = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${p.point.lat}&longitude=${p.point.lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=16`,
        { signal: AbortSignal.timeout(8000) },
      );
      if (!r.ok) throw Error();
      const data = await r.json();
      const i = data.daily?.time?.indexOf(p.date) ?? -1;
      if (i < 0)
        return NextResponse.json({
          status: "unknown",
          message: "旅行日期超出当前天气预报范围",
          source: "Open-Meteo",
        });
      const code = data.daily.weather_code[i];
      if (
        ![
          code,
          data.daily.temperature_2m_min[i],
          data.daily.temperature_2m_max[i],
        ].every((v) => typeof v === "number" && Number.isFinite(v))
      )
        throw Error();
      return NextResponse.json({
        status: "verified",
        message: `${data.daily.temperature_2m_min[i]}–${data.daily.temperature_2m_max[i]}°C · ${code <= 3 ? "晴 / 多云" : code < 50 ? "雾" : code < 80 ? "降水" : "阵雨 / 雷暴"}`,
        wet: code >= 51,
        severe: code >= 95,
        source: "Open-Meteo",
        date: p.date,
        fetchedAt: new Date().toISOString(),
      });
    }
    if (p.mode !== "drive") {
      const key = process.env.GOOGLE_MAPS_API_KEY;
      if (!key)
        return unknown(
          "公共交通尚未配置 Google Routes，无法计算路径与耗时。请使用官方交通规划器核验。",
        );
      if (!p.departure)
        return unknown("缺少可验证的出发时间，无法查询对应公共交通班次。");
      const r = await fetch(
        "https://routes.googleapis.com/directions/v2:computeRoutes",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask":
              "routes.duration,routes.description,routes.legs.steps.transitDetails",
          },
          body: JSON.stringify({
            origin: {
              location: {
                latLng: { latitude: p.from.lat, longitude: p.from.lng },
              },
            },
            destination: {
              location: { latLng: { latitude: p.to.lat, longitude: p.to.lng } },
            },
            travelMode: "TRANSIT",
            departureTime: p.departure,
            ...(p.mode === "bus" || p.mode === "train"
              ? {
                  transitPreferences: {
                    allowedTravelModes: [p.mode === "bus" ? "BUS" : "TRAIN"],
                  },
                }
              : {}),
          }),
          signal: AbortSignal.timeout(10000),
        },
      );
      if (!r.ok)
        return unknown("公共交通服务暂不可用或日期不受支持，无法计算班次。");
      const data = await r.json();
      const seconds = Number(data.routes?.[0]?.duration?.replace("s", ""));
      if (!Number.isFinite(seconds))
        return unknown("该时段没有找到公共交通路线。");
      return NextResponse.json({
        status: "verified",
        minutes: Math.ceil(seconds / 60),
        path: [],
        source: "Google Routes",
        message: "对应出发时间的公共交通估时；请在 Google Maps 查看路线详情。",
      });
    }
    const r = await fetch(
      `https://router.project-osrm.org/route/v1/driving/${p.from.lng},${p.from.lat};${p.to.lng},${p.to.lat}?overview=full&geometries=geojson`,
      { signal: AbortSignal.timeout(10000) },
    );
    if (!r.ok) throw Error();
    const data = await r.json();
    const route = data.routes?.[0];
    if (!route || !Number.isFinite(route.duration))
      return unknown("未找到可用道路路线");
    return NextResponse.json({
      status: "verified",
      minutes: Math.ceil(route.duration / 60),
      path: route.geometry.coordinates.map((c: number[]) => ({
        lat: c[1],
        lng: c[0],
      })),
      source: "OSRM / OpenStreetMap",
      message: "道路模型估时，不含实时路况；非公共交通时刻表。",
    });
  } catch {
    return NextResponse.json({
      status: "unknown",
      minutes: null,
      path: [],
      source: "服务不可用",
      message: "数据服务暂不可用，请稍后重试；未使用模拟数据替代。",
      results: [],
    });
  }
}
