"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { community, cities } from "@/lib/team-model";
import { TravelBuddy, WeekendScene } from "./TravelBuddy";
import dynamic from "next/dynamic";
import {
  ArrowRight,
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  Compass,
  MapPin,
  CalendarDays,
  Wallet,
  Users,
  TrainFront,
  Car,
  SlidersHorizontal,
  Bookmark,
  Check,
  Plus,
  X,
  LocateFixed,
  Mountain,
  Leaf,
  Sparkles,
  Share2,
  Clock,
  ExternalLink,
  CloudSun,
  Navigation,
  Trash2,
  RotateCcw,
} from "lucide-react";
import { destinations, defaultConditions } from "@/lib/data";
import {
  Conditions,
  Day,
  Leg,
  Plan,
  Point,
  conditionsSchema,
  planSchema,
  schedule,
  clock,
  draft,
  budget,
  validateCatalogPlan,
} from "@/lib/model";
import { route, service, unknownLeg, departureISO } from "@/lib/services";
const TravelMap = dynamic(() => import("./Map"), {
  ssr: false,
  loading: () => <div className="map-loading">正在展开地图…</div>,
});
const modes = {
  transit: "公共交通",
  drive: "自驾",
  train: "火车",
  bus: "巴士",
  any: "不限",
};
const interests = [
  "自然风景",
  "城市探索",
  "艺术文化",
  "美食",
  "休闲",
  "户外活动",
];
function travelDate(start: string, offset: number) {
  const d = new Date(start + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + offset);
  return d.toISOString().slice(0, 10);
}
function Weather({
  point,
  date,
  onIndoor,
}: {
  point: Point;
  date: string;
  onIndoor?: () => void;
}) {
  const [weather, setWeather] = useState<{
    message: string;
    source?: string;
    wet?: boolean;
    severe?: boolean;
  }>({ message: "正在查询目的地天气…" });
  useEffect(() => {
    const c = new AbortController();
    setWeather({ message: "正在查询目的地天气…" });
    service({ action: "weather", point, date }, c.signal)
      .then(setWeather)
      .catch(() => {
        if (!c.signal.aborted) setWeather({ message: "天气暂不可用" });
      });
    return () => c.abort();
  }, [point.lat, point.lng, date]);
  return (
    <div className={`weather ${weather.severe ? "warning" : ""}`}>
      <CloudSun size={17} />
      <span>
        {date} · {weather.message}
        {weather.source && <small>来源：{weather.source}</small>}
        {weather.severe && (
          <strong>雷暴风险：停止户外步道活动，查看当地官方警报。</strong>
        )}
        {weather.wet && onIndoor && (
          <button className="text-button" onClick={onIndoor}>
            查看室内替代地点 →
          </button>
        )}
      </span>
    </div>
  );
}
export default function Weekender({
  shared,
}: { shared?: { id: string; plan: Plan; readOnly: boolean } } = {}) {
  const [teamContext, setTeamContext] = useState<string | null>(
    shared?.id || null,
  );
  const readOnly = shared?.readOnly || false;
  const [view, setView] = useState<"home" | "explore" | "plan">("home");
  const [step, setStep] = useState(0);
  const [c, setC] = useState<Conditions>(defaultConditions);
  const [query, setQuery] = useState(defaultConditions.origin);
  const [located, setLocated] = useState(true);
  const [results, setResults] = useState<{ name: string; point: Point }[]>([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [selected, setSelected] = useState("blue-mountains");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [activeDay, setActiveDay] = useState(0);
  const [selectedStop, setSelectedStop] = useState("");
  const [adding, setAdding] = useState(false);
  const [indoor, setIndoor] = useState(false);
  const [saved, setSaved] = useState<Plan | null>(null);
  const [ready, setReady] = useState(false);
  const [legs, setLegs] = useState<Leg[]>([]);
  const [access, setAccess] = useState<Record<string, Leg>>({});
  const [routeBusy, setRouteBusy] = useState(false);
  const [outbound, setOutbound] = useState<Leg>(unknownLeg);
  const [inbound, setInbound] = useState<Leg>(unknownLeg);
  const destination =
    destinations.find(
      (d) => d.id === (view === "plan" ? plan?.destinationId : selected),
    ) || destinations[0];
  const current = plan?.days[activeDay];
  useEffect(() => {
    if (shared) {
      setPlan(shared.plan);
      setC(shared.plan.conditions);
      setQuery(shared.plan.conditions.origin);
      setView("plan");
      setReady(true);
      return;
    }
    const teamId = new URLSearchParams(location.search).get("team");
    if (teamId) {
      setTeamContext(teamId);
      Promise.all([community("detail", { id: teamId }), community("me")])
        .then(([{ team }, { user }]) => {
          if (!user || team.ownerId !== user.id) {
            setMessage("只有队长可以规划并关联行程。");
            setTeamContext(null);
            return;
          }
          const conditions = {
            ...defaultConditions,
            origin: team.city,
            point: cities[team.city as keyof typeof cities],
            date: team.date,
            days: team.days,
            budget: team.budgetMax,
            currency: team.currency,
            people: team.count,
            interests: team.interests,
          };
          setC(conditions);
          setQuery(team.city);
          setView("explore");
        })
        .catch((e) => {
          setMessage(e.message);
          setTeamContext(null);
        })
        .finally(() => setReady(true));
      return;
    }
    try {
      const raw = localStorage.getItem("weekender-plan-v2");
      if (raw) {
        const parsed = validateCatalogPlan(JSON.parse(raw), destinations);
        if (parsed) {
          setSaved(parsed);
          setPlan(parsed);
          setC(parsed.conditions);
          setQuery(parsed.conditions.origin);
          setView("plan");
        } else setMessage("保存的数据无效或地点不在候选库中，请重新创建行程。");
      }
    } catch {
      setMessage("本地计划无法读取，可重新创建。");
    }
    setReady(true);
  }, []);
  useEffect(() => {
    if (!ready || !plan || teamContext || shared) return;
    try {
      localStorage.setItem("weekender-plan-v2", JSON.stringify(plan));
      setSaved(plan);
    } catch {
      setMessage("浏览器存储不可用，请导出计划以免丢失。");
    }
  }, [plan, ready]);
  useEffect(() => {
    if (view !== "explore") return;
    const controller = new AbortController();
    setAccess({});
    destinations.forEach((d) =>
      route(
        c.point,
        d.point,
        c.transport,
        controller.signal,
        departureISO(c.date, "08:00"),
      )
        .then((l) => {
          if (!controller.signal.aborted)
            setAccess((a) => ({ ...a, [d.id]: l }));
        })
        .catch(() => {}),
    );
    return () => controller.abort();
  }, [view, c.point, c.transport, c.days, c.date]);
  useEffect(() => {
    if (view !== "plan" || !current) return;
    const controller = new AbortController();
    setLegs([]);
    setRouteBusy(true);
    setOutbound(unknownLeg);
    setInbound(unknownLeg);
    const dayDate = travelDate(plan!.conditions.date, activeDay);
    (async () => {
      const calculated: Leg[] = [];
      let cursor = new Date(departureISO(dayDate, current.start)).getTime();
      let known = true;
      for (let i = 1; i < current.stops.length; i++) {
        cursor += current.stops[i - 1].minutes * 60000;
        const leg = await route(
          current.stops[i - 1].point,
          current.stops[i].point,
          current.transport,
          controller.signal,
          known ? new Date(cursor).toISOString() : undefined,
        ).catch(() => unknownLeg);
        if (controller.signal.aborted) return;
        calculated.push(leg);
        if (leg.minutes != null) cursor += leg.minutes * 60000;
        else known = false;
      }
      if (controller.signal.aborted) return;
      setLegs(calculated);
      setRouteBusy(false);
      if (current.stops.length && activeDay === 0) {
        const leg = await route(
          plan!.conditions.point,
          current.stops[0].point,
          current.transport,
          controller.signal,
          departureISO(dayDate, "08:00"),
        ).catch(() => unknownLeg);
        if (!controller.signal.aborted) setOutbound(leg);
      }
      if (current.stops.length && activeDay === plan!.days.length - 1) {
        cursor += current.stops[current.stops.length - 1].minutes * 60000;
        const leg = await route(
          current.stops[current.stops.length - 1].point,
          plan!.conditions.point,
          current.transport,
          controller.signal,
          known ? new Date(cursor).toISOString() : undefined,
        ).catch(() => unknownLeg);
        if (!controller.signal.aborted) setInbound(leg);
      }
    })();
    return () => controller.abort();
  }, [view, current, activeDay, plan?.conditions]);
  const nearSydney =
    Math.abs(c.point.lat + 33.87) < 3 && Math.abs(c.point.lng - 151.2) < 3;
  const ranked = useMemo(
    () =>
      destinations
        .map((d) => ({
          d,
          score: d.tags.filter((t) => c.interests.includes(t)).length,
          leg: access[d.id],
        }))
        .filter(
          ({ leg }) =>
            !leg?.minutes || leg.minutes <= (c.days === 1 ? 150 : c.days * 180),
        )
        .sort((a, b) => b.score - a.score),
    [c, access],
  );
  const markers = useMemo(
    () =>
      view === "plan" && current
        ? current.stops.map((p, i) => ({
            id: p.id,
            name: p.name,
            point: p.point,
            label: String(i + 1),
          }))
        : [
            {
              id: "origin",
              name: c.origin,
              point: c.point,
              label: "⌂",
              origin: true,
            },
            ...(nearSydney
              ? ranked.map(({ d }) => ({
                  id: d.id,
                  name: d.name,
                  point: d.point,
                  label: c.transport === "drive" ? "↗" : "▤",
                }))
              : []),
          ],
    [view, current, c, ranked, nearSydney],
  );
  const paths = useMemo(
    () => legs.filter((l) => l.status === "verified").map((l) => l.path),
    [legs],
  );
  const totals = budget(plan?.conditions || c);
  const times = current ? schedule(current, legs) : [];
  const patch = (value: Partial<Conditions>) => setC({ ...c, ...value });
  function updateDay(next: Day) {
    if (!plan || readOnly) return;
    setPlan({
      ...plan,
      days: plan.days.map((d, i) => (i === activeDay ? next : d)),
      savedAt: new Date().toISOString(),
    });
  }
  function startPlan() {
    if (readOnly) return;
    const days = draft(c, destination);
    const p = {
      version: 2 as const,
      conditions: c,
      destinationId: destination.id,
      days,
      savedAt: new Date().toISOString(),
    };
    const valid = validateCatalogPlan(p, destinations);
    if (!valid) {
      setMessage("行程校验失败，请重新选择目的地。");
      return;
    }
    setPlan(valid);
    setActiveDay(0);
    setView("plan");
    setSelectedStop("");
    setMessage("已基于真实地点生成规则草案；交通和开放时间仍需验证。");
  }
  async function search() {
    setBusy(true);
    try {
      const data = await service({ action: "geocode", query });
      setResults(data.results || []);
      if (!data.results?.length)
        setMessage("未找到地址，或地理服务暂不可用。可使用悉尼演示出发地。");
    } catch {
      setMessage("地址查询失败，请重试。");
    }
    setBusy(false);
  }
  function locate() {
    if (!navigator.geolocation) {
      setMessage("浏览器不支持定位，请手动搜索。");
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const point = { lat: p.coords.latitude, lng: p.coords.longitude };
        const origin = `当前位置 ${point.lat.toFixed(4)}, ${point.lng.toFixed(4)}`;
        patch({ origin, point });
        setQuery(origin);
        setLocated(true);
        setBusy(false);
      },
      () => {
        setBusy(false);
        setMessage("未获得定位权限，请手动搜索城市、学校或地址。");
      },
      { timeout: 10000 },
    );
  }
  function explore() {
    const checked = conditionsSchema.safeParse(c);
    if (!located || !checked.success) {
      setMessage("请确认出发地、有效日期、人数与预算。");
      return;
    }
    setView("explore");
    setSelected("blue-mountains");
  }
  async function save() {
    if (!plan || readOnly) return;
    if (teamContext) {
      try {
        await community("savePlan", { id: teamContext, plan });
        setMessage("共享行程已保存，队伍成员刷新即可查看。");
      } catch (e) {
        setMessage(e instanceof Error ? e.message : "保存失败");
      }
      return;
    }
    try {
      const next = { ...plan, savedAt: new Date().toISOString() };
      localStorage.setItem("weekender-plan-v2", JSON.stringify(next));
      setPlan(next);
      setSaved(next);
      setMessage("完整行程已保存在此浏览器，刷新后可继续编辑。");
    } catch {
      setMessage("保存失败，请导出行程。");
    }
  }
  function exportPlan() {
    if (!plan) return;
    const blob = new Blob([JSON.stringify(plan, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekender-${destination.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setMessage("已导出行程文件，可以分享给同行伙伴。");
  }
  return (
    <div className={`app ${readOnly ? "shared-readonly" : ""}`}>
      <header className="header">
        <button className="brand" onClick={() => setView("home")}>
          <span className="local-brand">W</span>
          WEEKENDER<span className="version">周末就要一起玩</span>
        </button>
        <nav>
          <button
            className={view !== "plan" ? "nav-active" : ""}
            onClick={() => setView("home")}
          >
            发现旅程
          </button>
          <Link href="/teams">找搭子</Link>
          <button
            className={view === "plan" ? "nav-active" : ""}
            onClick={() => {
              if (saved) {
                setPlan(saved);
                setActiveDay(0);
                setView("plan");
              } else setMessage("还没有保存的旅程，先从地图选择一个目的地。");
            }}
          >
            <Bookmark size={15} />
            我的行程{saved && <i />}
          </button>
        </nav>
        <span className="avatar">
          <TravelBuddy />
        </span>
      </header>
      {teamContext && (
        <div className="shared-banner">
          <Link href={`/teams/${teamContext}`}>← 返回队伍</Link>
          <span>
            {readOnly
              ? "成员只读 · 共享行程由队长编辑"
              : "队长编辑 · 修改后点击保存同步给成员"}
          </span>
        </div>
      )}
      {message && (
        <div className="toast" role="status">
          {message}
          <button aria-label="关闭提示" onClick={() => setMessage("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {view === "home" ? (
        <main className="home">
          <div className="intro">
            <span className="eyebrow">
              <span className="dot" /> HELLO, WEEKEND!
            </span>
            <h1>
              还没想好去哪？
              <br />
              从这里，<em>发现你的周末。</em>
            </h1>
            <p>
              带上时间、预算和一点好奇心。
              <br />
              让地图带你找到，刚刚好的下一站。
            </p>
            <div className="intro-foot">
              <span>
                <MapPin size={15} /> 从身边出发
              </span>
              <span>
                <Leaf size={15} /> 按你的节奏
              </span>
              <span>
                <Compass size={15} /> 探索更多可能
              </span>
            </div>
          </div>
          <div className="home-grid">
            <section className="wizard">
              <div className="stepper">
                {["从哪里出发", "有多少时间", "怎样的旅行"].map((s, i) => (
                  <button
                    key={s}
                    onClick={() => setStep(i)}
                    className={step === i ? "current" : step > i ? "done" : ""}
                  >
                    <b>{step > i ? <Check size={14} /> : i + 1}</b>
                    {s}
                  </button>
                ))}
              </div>
              <div className="form-content">
                <span className="eyebrow">LET’S PLAN SOMETHING FUN</span>
                <h2>
                  {
                    [
                      "先定起点，不急着定终点。",
                      "给自己，留一点出走的时间。",
                      "什么样的旅行，让你心动？",
                    ][step]
                  }
                </h2>
                <p className="muted">
                  {
                    [
                      "城市、学校，或你现在所在的地方。",
                      "一天的自在，或一个完整的周末。",
                      "只需几个选择，剩下的交给探索。",
                    ][step]
                  }
                </p>
                {step === 0 && (
                  <>
                    <label>我的出发地</label>
                    <div className="search-input">
                      <MapPin size={20} />
                      <input
                        value={query}
                        onChange={(e) => {
                          setQuery(e.target.value);
                          setLocated(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") search();
                        }}
                        placeholder="输入城市、学校或详细地址"
                      />
                      <button
                        onClick={search}
                        disabled={busy || query.length < 2}
                      >
                        {busy ? "查询中" : "搜索"}
                      </button>
                    </div>
                    {results.length > 0 && (
                      <div className="search-results">
                        {results.map((r) => (
                          <button
                            key={r.name}
                            onClick={() => {
                              patch({ origin: r.name, point: r.point });
                              setQuery(r.name);
                              setResults([]);
                              setLocated(true);
                            }}
                          >
                            {r.name}
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      className="location-button"
                      onClick={locate}
                      disabled={busy}
                    >
                      <LocateFixed size={16} /> 使用我的当前位置
                    </button>
                    <div className="origin-preview">
                      <div className="mini-map">
                        <MapPin size={24} />
                      </div>
                      <div>
                        <strong>
                          {located ? c.origin : "请选择搜索结果确认出发地"}
                        </strong>
                        <small>
                          {located
                            ? `${c.point.lat.toFixed(3)}°, ${c.point.lng.toFixed(3)}° · 已确认起点`
                            : "支持任意城市，不需要定位授权"}
                        </small>
                      </div>
                      {located && <Check size={19} />}
                    </div>
                    <div className="helper">
                      先试一试？
                      <button
                        className="text-button"
                        onClick={() => {
                          patch({
                            origin: defaultConditions.origin,
                            point: defaultConditions.point,
                          });
                          setQuery(defaultConditions.origin);
                          setLocated(true);
                        }}
                      >
                        使用悉尼演示出发地 ↗
                      </button>
                    </div>
                  </>
                )}
                {step === 1 && (
                  <>
                    <div className="duration-options">
                      {[1, 2, 3].map((n) => (
                        <button
                          key={n}
                          className={c.days === n ? "chosen" : ""}
                          onClick={() => patch({ days: n })}
                        >
                          <CalendarDays size={24} />
                          <strong>
                            {n === 1 ? "一天内往返" : `${n} 天 ${n - 1} 晚`}
                          </strong>
                          <small>
                            {
                              ["换个地方呼吸", "刚刚好的周末", "多一点自由"][
                                n - 1
                              ]
                            }
                          </small>
                        </button>
                      ))}
                    </div>
                    <div className="form-row">
                      <label>
                        出发日期
                        <input
                          type="date"
                          value={c.date}
                          onChange={(e) => patch({ date: e.target.value })}
                        />
                      </label>
                      <label>
                        自定义天数（1–7）
                        <input
                          type="number"
                          min="1"
                          max="7"
                          value={c.days}
                          onChange={(e) =>
                            patch({ days: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                  </>
                )}
                {step === 2 && (
                  <>
                    <div className="form-row">
                      <label>
                        全员总预算
                        <div className="currency-input">
                          <select
                            aria-label="币种"
                            value={c.currency}
                            onChange={(e) =>
                              patch({
                                currency: e.target
                                  .value as Conditions["currency"],
                              })
                            }
                          >
                            {["AUD", "USD", "CNY"].map((v) => (
                              <option key={v}>{v}</option>
                            ))}
                          </select>
                          <input
                            aria-label="总预算"
                            type="number"
                            min="1"
                            value={c.budget}
                            onChange={(e) =>
                              patch({ budget: Number(e.target.value) })
                            }
                          />
                        </div>
                      </label>
                      <label>
                        出行人数
                        <input
                          type="number"
                          min="1"
                          max="12"
                          value={c.people}
                          onChange={(e) =>
                            patch({ people: Number(e.target.value) })
                          }
                        />
                      </label>
                    </div>
                    <label>交通偏好</label>
                    <div className="chips">
                      {Object.entries(modes).map(([key, text]) => (
                        <button
                          className={c.transport === key ? "chosen" : ""}
                          key={key}
                          onClick={() =>
                            patch({ transport: key as Conditions["transport"] })
                          }
                        >
                          {text}
                        </button>
                      ))}
                    </div>
                    <label>
                      想收集怎样的风景 <small>可多选</small>
                    </label>
                    <div className="chips">
                      {interests.map((x) => (
                        <button
                          key={x}
                          className={c.interests.includes(x) ? "chosen" : ""}
                          onClick={() =>
                            patch({
                              interests: c.interests.includes(x)
                                ? c.interests.filter((v) => v !== x)
                                : [...c.interests, x],
                            })
                          }
                        >
                          {x}
                        </button>
                      ))}
                    </div>
                    <label>旅行节奏</label>
                    <div className="chips">
                      {(["easy", "medium", "full"] as const).map((x, i) => (
                        <button
                          key={x}
                          className={c.pace === x ? "chosen" : ""}
                          onClick={() => patch({ pace: x })}
                        >
                          {
                            ["轻松 · 慢慢逛", "适中 · 刚刚好", "充实 · 多看看"][
                              i
                            ]
                          }
                        </button>
                      ))}
                    </div>
                  </>
                )}
                <div className="form-bottom">
                  <span>
                    <span className="dot" />{" "}
                    {step === 0 ? "无需先选目的地" : "随时可以回来调整"}
                  </span>
                  <button
                    className="primary"
                    disabled={step === 0 && !located}
                    onClick={() => (step < 2 ? setStep(step + 1) : explore())}
                  >
                    {step === 2 ? "去地图发现目的地" : "下一步"}
                    <ArrowRight size={18} />
                  </button>
                </div>
              </div>
            </section>
            <aside className="inspiration">
              <WeekendScene />
            </aside>
          </div>
          <div className="home-team-entry">
            <span>周末想出发，缺一个同频的人？</span>
            <Link href="/teams">找搭子一起去 ↗</Link>
          </div>
          <footer>
            <span>小小的出发，也值得好好计划。</span>
            <span>
              真实地点 <i /> 透明估算 <i /> 自由探索
            </span>
          </footer>
        </main>
      ) : (
        <main className="workspace">
          <div className="workspace-heading">
            <div>
              <span className="eyebrow">
                {view === "explore"
                  ? "FIND YOUR SOMEWHERE"
                  : "MAKE IT YOUR OWN"}
              </span>
              <h1>
                {view === "explore"
                  ? "你的周末，可以去这里。"
                  : `${destination.name}，慢慢走。`}
              </h1>
            </div>
            <div className="heading-actions">
              {view === "plan" && !teamContext && (
                <button
                  className="secondary"
                  onClick={() => {
                    if (plan) {
                      sessionStorage.setItem(
                        "weekender-team-draft",
                        JSON.stringify(plan),
                      );
                      location.assign("/teams/new?from=plan");
                    }
                  }}
                >
                  <Users size={16} />
                  找搭子一起去
                </button>
              )}
              {view === "plan" ? (
                <>
                  <button
                    className="secondary"
                    onClick={() => setView("explore")}
                  >
                    <ArrowLeft size={16} />
                    返回探索
                  </button>
                  <button className="secondary" onClick={exportPlan}>
                    <Share2 size={16} />
                    导出分享
                  </button>
                  <button className="primary" onClick={save}>
                    <Bookmark size={16} />
                    保存行程
                  </button>
                </>
              ) : (
                <span className="subtle">
                  <Sparkles size={16} /> 从真实地点开始发现
                </span>
              )}
            </div>
          </div>
          <div className="conditions-bar">
            <span>
              <MapPin size={16} />
              {(view === "plan" ? plan?.conditions.origin : c.origin)
                ?.split("·")[0]
                .slice(0, 40)}
            </span>
            <span>
              <CalendarDays size={16} />
              {(plan && view === "plan" ? plan.conditions : c).days} 天 ·{" "}
              {(plan && view === "plan" ? plan.conditions : c).date}
            </span>
            <span>
              <Wallet size={16} />
              {(plan && view === "plan" ? plan.conditions : c).currency}{" "}
              {(plan && view === "plan" ? plan.conditions : c).budget} / 总预算
            </span>
            <span>
              <Users size={16} />
              {(plan && view === "plan" ? plan.conditions : c).people} 人
            </span>
            <span>
              <TrainFront size={16} />
              {modes[(plan && view === "plan" ? plan.conditions : c).transport]}
            </span>
            <button
              onClick={() => {
                setView("home");
                setStep(2);
              }}
            >
              <SlidersHorizontal size={15} />
              修改条件
            </button>
          </div>
          {view === "explore" ? (
            <div className="explore-layout">
              <aside className="destination-list">
                <div className="list-title">
                  <h3>
                    值得探索的地方 <span>{nearSydney ? ranked.length : 0}</span>
                  </h3>
                  <small>按兴趣匹配排序</small>
                </div>
                <div className="notice">
                  <Compass size={16} />
                  <span>
                    悉尼周边示例库 · 初步探索
                    <br />
                    公共交通、住宿及总预算尚未验证。
                  </span>
                </div>
                {!nearSydney && (
                  <div className="empty">
                    <h3>这个起点还没有候选数据</h3>
                    <p>
                      已定位到你的出发地。目前种子库覆盖悉尼周边；其他城市需要接入地点数据服务。
                    </p>
                    <button
                      className="secondary"
                      onClick={() => {
                        setC(defaultConditions);
                        setQuery(defaultConditions.origin);
                      }}
                    >
                      体验悉尼示例
                    </button>
                  </div>
                )}
                {nearSydney &&
                  ranked.map(({ d, score, leg }, i) => (
                    <article
                      key={d.id}
                      className={`destination-card ${selected === d.id ? "selected" : ""}`}
                    >
                      <button
                        className="destination-select"
                        onClick={() => setSelected(d.id)}
                      >
                        <div className="card-image">
                          <img src={d.image} alt="旅行灵感配图，非目的地实景" />
                          <span>
                            {i === 0 ? "与你的兴趣最契合" : "换一种周末"}
                          </span>
                          <small>灵感配图</small>
                        </div>
                        <div className="card-body">
                          <div className="card-title">
                            <h2>{d.name}</h2>
                            <span>
                              {c.transport === "drive" ? (
                                <Car size={18} />
                              ) : (
                                <TrainFront size={18} />
                              )}
                            </span>
                          </div>
                          <p className="english">{d.english}</p>
                          <div className="tags">
                            {d.tags.map((t) => (
                              <span key={t}>{t}</span>
                            ))}
                          </div>
                          <p className="reason">{d.description}</p>
                          <div className="card-meta">
                            <span>
                              <Clock size={13} />
                              {leg?.minutes
                                ? `单程约 ${leg.minutes} 分钟`
                                : "单程时间待验证"}
                            </span>
                            <span>{score} 项兴趣匹配</span>
                          </div>
                        </div>
                      </button>
                      {selected === d.id && (
                        <div className="card-expanded">
                          <Weather point={d.point} date={c.date} />
                          <p>
                            建议探索 {c.days} 天 · 适配性待路线验证
                            <br />
                            交通费用：待确认 · 总预算：待核验
                            <br />
                            人流情况：暂无可靠人流数据
                          </p>
                          <a href={d.source} target="_blank" rel="noreferrer">
                            目的地资料来源 ↗
                          </a>
                          <button className="primary full" onClick={startPlan}>
                            为我规划行程
                            <ArrowRight size={16} />
                          </button>
                        </div>
                      )}
                    </article>
                  ))}
              </aside>
              <div className="explore-map">
                <TravelMap
                  markers={markers}
                  selected={selected}
                  onSelect={(id) => {
                    if (id !== "origin") setSelected(id);
                  }}
                />
                <div className="floating-map-note">
                  <div className="round-icon">
                    <TravelBuddy kind="cat" />
                  </div>
                  <div>
                    <strong>跟着好奇心，走远一点。</strong>
                    <small>点击地图标记，看看下一站有什么。</small>
                  </div>
                </div>
                <div className="map-legend">
                  <span className="legend-origin" />
                  出发地 <span className="legend-destination" />
                  可探索目的地
                </div>
              </div>
            </div>
          ) : (
            plan &&
            current && (
              <>
                <div className="plan-tabs">
                  {plan.days.map((day, i) => (
                    <button
                      className={i === activeDay ? "active" : ""}
                      key={day.id}
                      onClick={() => {
                        setActiveDay(i);
                        setSelectedStop("");
                        setAdding(false);
                      }}
                    >
                      Day {i + 1}
                      <small>
                        {travelDate(plan.conditions.date, i).slice(5)} ·{" "}
                        {day.stops.length} 个地点
                      </small>
                    </button>
                  ))}
                  <span>
                    <Check size={14} />{" "}
                    {teamContext ? "共享行程 · 手动保存" : "自动保存至本地"}
                  </span>
                </div>
                <div className="planner-layout">
                  <section className="day-panel">
                    <div className="day-heading">
                      <div>
                        <span className="eyebrow">
                          DAY {activeDay + 1} / {plan.days.length}
                        </span>
                        <h2>
                          {activeDay === 0
                            ? "让旅程，慢慢展开。"
                            : activeDay === plan.days.length - 1
                              ? "再看一些风景，然后回家。"
                              : "今天，也有新的发现。"}
                        </h2>
                      </div>
                      <button
                        className="icon-button"
                        title="重新规划当天"
                        onClick={() => {
                          const fresh = draft(plan.conditions, destination)[
                            activeDay
                          ];
                          updateDay(fresh);
                          setMessage("已恢复当天草案，路线与时间重新计算。");
                        }}
                      >
                        <RotateCcw size={17} />
                      </button>
                    </div>
                    <Weather
                      point={destination.point}
                      date={travelDate(plan.conditions.date, activeDay)}
                      onIndoor={() => {
                        setIndoor(true);
                        setAdding(true);
                      }}
                    />
                    <div className="notice">
                      <Sparkles size={16} />
                      <span>
                        规则规划草案 · 未调用大模型
                        <br />
                        开放时间未核验，尚非可直接执行的交通计划。
                      </span>
                    </div>
                    <div className="day-controls">
                      <label>
                        首站开始
                        <input
                          type="time"
                          value={current.start}
                          onChange={(e) => {
                            if (e.target.value)
                              updateDay({ ...current, start: e.target.value });
                          }}
                        />
                      </label>
                      <label>
                        当天交通
                        <select
                          value={current.transport}
                          onChange={(e) =>
                            updateDay({
                              ...current,
                              transport: e.target.value as Day["transport"],
                            })
                          }
                        >
                          {Object.entries(modes).map(([k, v]) => (
                            <option value={k} key={k}>
                              {v}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>
                    {activeDay === 0 && (
                      <div className="transfer-note">
                        <Navigation size={16} />
                        <span>
                          从 {plan.conditions.origin.split("·")[0]} 出发
                          <br />
                          <strong>
                            {outbound.minutes != null
                              ? `08:00 出发 · 预计 ${clock(480 + outbound.minutes)} 到达`
                              : "08:00 目标出发 · 到达时间待核验"}
                          </strong>{" "}
                          · 首站时间为计划目标
                          {outbound.minutes != null &&
                            480 + outbound.minutes >
                              Number(current.start.slice(0, 2)) * 60 +
                                Number(current.start.slice(3)) && (
                              <strong className="conflict">
                                {" "}
                                到达晚于首站开始，请调整首站时间。
                              </strong>
                            )}
                          <br />
                          <a
                            href={`https://www.google.com/maps/dir/?api=1&origin=${plan.conditions.point.lat},${plan.conditions.point.lng}&destination=${destination.point.lat},${destination.point.lng}&travelmode=${current.transport === "drive" ? "driving" : "transit"}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            打开交通规划器核对 ↗
                          </a>
                        </span>
                      </div>
                    )}
                    <div className="timeline">
                      {current.stops.length === 0 && (
                        <div className="empty">
                          这一天留白了。添加一个你想去的地方。
                        </div>
                      )}
                      {current.stops.map((p, i) => (
                        <div key={p.id} className="timeline-item">
                          <div className="stop-index">{i + 1}</div>
                          <article
                            className={`stop-card ${selectedStop === p.id ? "selected" : ""}`}
                          >
                            <button
                              className="stop-name"
                              onClick={() => setSelectedStop(p.id)}
                            >
                              <span>
                                {clock(times[i]?.arrival ?? null)}
                                <small>
                                  {times[i]?.departure != null
                                    ? `— ${clock(times[i].departure)}`
                                    : " · 后续时间待路线验证"}
                                </small>
                              </span>
                              <h3>{p.name}</h3>
                            </button>
                            <span className="stop-type">{p.type}</span>
                            <p>{p.note}</p>
                            <div className="stop-edit">
                              <label>
                                停留{" "}
                                <select
                                  aria-label={`${p.name}停留时长`}
                                  value={p.minutes}
                                  onChange={(e) =>
                                    updateDay({
                                      ...current,
                                      stops: current.stops.map((s) =>
                                        s.id === p.id
                                          ? {
                                              ...s,
                                              minutes: Number(e.target.value),
                                            }
                                          : s,
                                      ),
                                    })
                                  }
                                >
                                  {[30, 60, 90, 120, 180].map((n) => (
                                    <option key={n} value={n}>
                                      {n} 分钟
                                    </option>
                                  ))}
                                </select>
                              </label>
                              <div>
                                <button
                                  aria-label={`上移${p.name}`}
                                  disabled={i === 0}
                                  onClick={() => {
                                    const stops = [...current.stops];
                                    [stops[i - 1], stops[i]] = [
                                      stops[i],
                                      stops[i - 1],
                                    ];
                                    updateDay({ ...current, stops });
                                  }}
                                >
                                  <ArrowUp size={15} />
                                </button>
                                <button
                                  aria-label={`下移${p.name}`}
                                  disabled={i === current.stops.length - 1}
                                  onClick={() => {
                                    const stops = [...current.stops];
                                    [stops[i + 1], stops[i]] = [
                                      stops[i],
                                      stops[i + 1],
                                    ];
                                    updateDay({ ...current, stops });
                                  }}
                                >
                                  <ArrowDown size={15} />
                                </button>
                                <button
                                  aria-label={`删除${p.name}`}
                                  onClick={() =>
                                    updateDay({
                                      ...current,
                                      stops: current.stops.filter(
                                        (s) => s.id !== p.id,
                                      ),
                                    })
                                  }
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                            <a
                              className="source-link"
                              href={p.source}
                              target="_blank"
                              rel="noreferrer"
                            >
                              真实地点 · OpenStreetMap ↗
                            </a>
                          </article>
                          {i < current.stops.length - 1 && (
                            <div className="leg">
                              <TrainFront size={13} />
                              {routeBusy
                                ? "正在重新计算…"
                                : legs[i]?.minutes != null
                                  ? `${modes[current.transport]} · ${legs[i].minutes} 分钟 · ${legs[i].source}`
                                  : `${modes[current.transport]} · 路径及耗时不可计算`}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                    <button
                      className="add-stop"
                      onClick={() => {
                        setAdding(!adding);
                        setIndoor(false);
                      }}
                    >
                      <Plus size={17} />
                      添加一个地点
                    </button>
                    {times.some(
                      (t) => t.departure != null && t.departure > 20 * 60,
                    ) && (
                      <div className="notice">
                        当天活动超过
                        20:00，建议减少地点或停留时长，并核对夜间开放情况。
                      </div>
                    )}
                    {adding && (
                      <div className="add-list">
                        <strong>
                          {indoor
                            ? "室内替代候选 · 开放时间待核验"
                            : "来自真实 POI 候选库"}
                        </strong>
                        {destination.pois
                          .filter(
                            (p) =>
                              !current.stops.some((s) => s.id === p.id) &&
                              (!indoor || p.type === "艺术文化"),
                          )
                          .map((p) => (
                            <button
                              key={p.id}
                              onClick={() => {
                                updateDay({
                                  ...current,
                                  stops: [...current.stops, p],
                                });
                                setAdding(false);
                              }}
                            >
                              {p.name}
                              <Plus size={15} />
                            </button>
                          ))}
                        {destination.pois.every((p) =>
                          current.stops.some((s) => s.id === p.id),
                        ) && <p>候选地点均已添加。</p>}
                      </div>
                    )}
                    <div className="transfer-note">
                      <MapPin size={16} />
                      <span>
                        {activeDay === plan.days.length - 1
                          ? `返程：${inbound.minutes != null ? `预计 ${inbound.minutes} 分钟 · ${inbound.source}` : "返回出发地，耗时待核验"}。末班车及到家时间需再次核对。`
                          : `住宿建议：${destination.stay}`}
                      </span>
                    </div>
                  </section>
                  <section className="plan-map">
                    <TravelMap
                      markers={markers}
                      selected={selectedStop}
                      onSelect={setSelectedStop}
                      paths={paths}
                    />
                    <div className="day-map-title">
                      <span className="dot" /> Day {activeDay + 1} ·{" "}
                      {current.stops.length} 个地点{" "}
                      <small>
                        {routeBusy
                          ? "正在更新路线"
                          : legs.some(
                                (l) => l.status === "verified" && l.path.length,
                              )
                            ? "道路路线已更新"
                            : legs.some((l) => l.status === "verified")
                              ? "Google 班次估时已验证 · 路径请在交通规划器查看"
                              : "交通路线未验证 · 不绘制虚拟连线"}
                      </small>
                    </div>
                  </section>
                  <aside className="budget-panel">
                    <span className="eyebrow">TRAVEL AT A GLANCE</span>
                    <h3>给快乐，一点余地。</h3>
                    <div className="budget-total">
                      <span>{plan.conditions.currency}</span>
                      <strong>{plan.conditions.budget}</strong>
                      <small>{plan.conditions.people} 人 · 全程预算上限</small>
                    </div>
                    <div className="budget-line">
                      <span>交通</span>
                      <strong>待确认</strong>
                    </div>
                    <div className="budget-line">
                      <span>住宿 / {plan.conditions.days - 1} 晚</span>
                      <strong>
                        {totals
                          ? `A$${totals.lodging[0]}–${totals.lodging[1]}`
                          : "待确认"}
                      </strong>
                    </div>
                    <div className="budget-line">
                      <span>餐饮 / {plan.conditions.days} 天</span>
                      <strong>
                        {totals
                          ? `A$${totals.food[0]}–${totals.food[1]}`
                          : "待确认"}
                      </strong>
                    </div>
                    <div className="budget-line">
                      <span>
                        活动 /{" "}
                        {plan.days.reduce((n, d) => n + d.stops.length, 0)} 站
                      </span>
                      <strong>待确认</strong>
                    </div>
                    <div className="budget-status">总预算可行性待核验</div>
                    <p>
                      住宿、餐饮区间为产品演示假设，按人数与天数估算，不是商家报价。交通与门票未计入。
                    </p>
                    <div className="daily-cost">
                      <strong>Day {activeDay + 1} 预计花费</strong>
                      <span>待确认</span>
                      <small>修改站点后，活动费用及总额需重新核验。</small>
                    </div>
                    <hr />
                    <h4>出发前的小提醒</h4>
                    <p>
                      开放时间与预约：待确认
                      <br />
                      实时人流：暂无可靠人流数据
                      <br />
                      首日交通与末日返程：待确认
                    </p>
                    <a
                      href={destination.source}
                      target="_blank"
                      rel="noreferrer"
                    >
                      查看官方目的地指南 <ExternalLink size={13} />
                    </a>
                    <div className="quiet-note">
                      <TravelBuddy kind="cat" />
                      <p>
                        不用把每一分钟填满。
                        <br />
                        给偶遇，留一点空白。
                      </p>
                    </div>
                  </aside>
                </div>
              </>
            )
          )}
        </main>
      )}
    </div>
  );
}
