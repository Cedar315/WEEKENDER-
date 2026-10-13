"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Plus,
  MapPin,
  CalendarDays,
  Users,
  ArrowRight,
  Compass,
  Flag,
  CloudSun,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import { cities, community, Team, User } from "@/lib/team-model";
import { destinations } from "@/lib/data";
import { Plan, validateCatalogPlan } from "@/lib/model";
import { service } from "@/lib/services";
const interests = [
  "自然风景",
  "城市探索",
  "艺术文化",
  "美食",
  "休闲",
  "户外活动",
];
export function TeamNav() {
  return (
    <header className="header">
      <Link className="brand" href="/">
        <span className="local-brand">W</span>WEEKENDER
        <span className="version">周末就要一起玩</span>
      </Link>
      <nav>
        <Link href="/">发现旅程</Link>
        <Link className="nav-active" href="/teams">
          找搭子
        </Link>
        <Link href="/">我的行程</Link>
      </nav>
    </header>
  );
}
function Conditions({ team }: { team: Team }) {
  const [weather, setWeather] = useState("正在查询目的地天气…");
  const d = destinations.find((d) => d.id === team.destination);
  useEffect(() => {
    if (!d) {
      setWeather("目的地待定，确定后查询天气");
      return;
    }
    let active = true;
    service({ action: "weather", point: d.point, date: team.date })
      .then((x) => {
        if (active)
          setWeather(
            `${x.message}${x.source ? " · " + x.source : ""}${x.severe ? " · 严重天气：暂停户外活动，查看官方预警" : x.wet ? " · 建议增加室内备选" : ""}`,
          );
      })
      .catch(() => {
        if (active) setWeather("天气暂不可用");
      });
    return () => {
      active = false;
    };
  }, [d, team.date]);
  return (
    <div className="team-conditions">
      <span>
        <CloudSun size={16} />
        {weather}
      </span>
      <span>
        <Users size={16} />
        暂无可靠人流数据
      </span>
    </div>
  );
}
export default function Teams({
  id,
  create = false,
}: {
  id?: string;
  create?: boolean;
}) {
  const [user, setUser] = useState<User | null>(null),
    [loaded, setLoaded] = useState(false),
    [teams, setTeams] = useState<Team[]>([]),
    [team, setTeam] = useState<Team | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [auth, setAuth] = useState(false),
    [register, setRegister] = useState(false);
  const [city, setCity] = useState(""),
    [date, setDate] = useState(""),
    [days, setDays] = useState(""),
    [price, setPrice] = useState(""),
    [interest, setInterest] = useState(""),
    [currency, setCurrency] = useState("AUD");
  const [linked, setLinked] = useState<Plan | null>(null),
    [selectedInterests, setSelectedInterests] = useState(["自然风景"]),
    [reporting, setReporting] = useState(false);
  async function refresh() {
    const [me, data] = await Promise.all([
      community("me"),
      community(id ? "detail" : "list", id ? { id } : {}),
    ]);
    setUser(me.user);
    if (id) setTeam(data.team);
    else setTeams(data.teams);
    setLoaded(true);
  }
  useEffect(() => {
    refresh().catch((e) => {
      setError(e.message);
      setLoaded(true);
    });
    if (create && new URLSearchParams(location.search).get("from") === "plan") {
      try {
        const raw = sessionStorage.getItem("weekender-team-draft");
        const p = raw && validateCatalogPlan(JSON.parse(raw), destinations);
        if (p) {
          setLinked(p);
          setSelectedInterests(
            p.conditions.interests.length
              ? p.conditions.interests
              : ["自然风景"],
          );
        } else setError("没有可关联的行程，可从零创建或返回个人行程重新发起。");
      } catch {
        setError("无法读取行程，请返回行程页面重新创建。");
      }
    }
    const timer = setInterval(() => refresh().catch(() => {}), 15000);
    return () => clearInterval(timer);
  }, [id, create]);
  async function run(fn: () => Promise<void>) {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }
  const filtered = teams.filter(
    (t) =>
      (!city || t.city === city) &&
      (!date || t.date === date) &&
      (!days || t.days === Number(days)) &&
      (!price || (t.currency === currency && t.budgetMin <= Number(price))) &&
      (!interest || t.interests.includes(interest)),
  );
  async function mutate(action: string, requestId?: string) {
    if (!user) {
      setAuth(true);
      return;
    }
    await run(async () => {
      await community(action, { id, requestId });
      await refresh();
    });
  }
  return (
    <>
      <TeamNav />
      <main className="teams-page">
        <div className="teams-heading">
          <div>
            <span className="eyebrow">WEEKEND TOGETHER</span>
            <h1>
              {create
                ? "发起一场快乐出发。"
                : id
                  ? team?.title || "队伍详情"
                  : "一起出发，更有意思。"}
            </h1>
            <p>
              {create
                ? "有计划也好，还没想好也好，先找到同频的人。"
                : id
                  ? "小队伍，慢旅行。把同一个周末过成共同回忆。"
                  : "不用等朋友都有空，在这里找到同频的周末搭子。"}
            </p>
          </div>
          <div className="heading-actions">
            {!create && !id && (
              <Link href="/teams/new" className="primary">
                <Plus size={18} />
                发起组队
              </Link>
            )}
            <button
              className="secondary"
              onClick={() =>
                user
                  ? run(async () => {
                      await community("logout");
                      await refresh();
                    })
                  : setAuth(true)
              }
            >
              {user ? `${user.name} · 退出登录` : "登录 / 注册"}
            </button>
          </div>
        </div>
        {error && (
          <div className="team-alert" role="status">
            {error}
          </div>
        )}
        {auth && (
          <section className="auth-box">
            <div>
              <h2>{register ? "注册 WEEKENDER" : "欢迎回来"}</h2>
              <p>使用独立账号登录。昵称公开，账号名不公开。</p>
            </div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const f = new FormData(e.currentTarget);
                run(async () => {
                  await community(register ? "register" : "login", {
                    username: f.get("username"),
                    password: f.get("password"),
                    ...(register ? { name: f.get("name") } : {}),
                  });
                  setAuth(false);
                  await refresh();
                });
              }}
            >
              {register && (
                <label>
                  公开昵称
                  <input name="name" required minLength={2} maxLength={24} />
                </label>
              )}
              <label>
                账号
                <input
                  name="username"
                  required
                  pattern="[a-zA-Z0-9_]{3,30}"
                  placeholder="3–30 位字母、数字或下划线"
                  autoComplete="username"
                />
              </label>
              <label>
                密码
                <input
                  name="password"
                  type="password"
                  required
                  minLength={10}
                  maxLength={128}
                  autoComplete={register ? "new-password" : "current-password"}
                  placeholder="至少 10 位"
                />
              </label>
              <button disabled={busy} className="primary">
                {register ? "注册并登录" : "登录"}
              </button>
              <button type="button" onClick={() => setRegister(!register)}>
                {register ? "已有账号" : "创建账号"}
              </button>
              <button type="button" onClick={() => setAuth(false)}>
                取消
              </button>
            </form>
          </section>
        )}
        {create ? (
          <div className="team-create-layout">
            <form
              className="team-form"
              key={linked?.savedAt || "new"}
              onSubmit={(e) => {
                e.preventDefault();
                if (!user) {
                  setAuth(true);
                  return;
                }
                const f = new FormData(e.currentTarget);
                run(async () => {
                  const body = {
                    title: f.get("title"),
                    city: f.get("city"),
                    date: linked?.conditions.date || f.get("date"),
                    days: linked?.conditions.days || Number(f.get("days")),
                    budgetMin: Number(f.get("min")),
                    budgetMax: Number(f.get("max")),
                    currency: linked?.conditions.currency || f.get("currency"),
                    maxMembers: Number(f.get("members")),
                    interests: selectedInterests,
                    description: f.get("description"),
                    consent: f.get("consent") === "on",
                    ...(linked ? { plan: linked } : {}),
                  };
                  const result = await community("create", { team: body });
                  sessionStorage.removeItem("weekender-team-draft");
                  location.assign("/teams/" + result.id);
                });
              }}
            >
              <div className="form-section-label">
                01 <span>先说说，这次怎么玩</span>
              </div>
              <label>
                队伍名称
                <input
                  name="title"
                  required
                  minLength={3}
                  maxLength={60}
                  placeholder="例如：周末去蓝山，找两个一起看风景的搭子"
                  defaultValue={
                    linked
                      ? `${destinations.find((d) => d.id === linked.destinationId)?.name}周末小分队`
                      : ""
                  }
                />
              </label>
              <div className="form-row">
                <label>
                  公开出发城市
                  <select name="city" defaultValue="Sydney">
                    {Object.keys(cities).map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </label>
                <label>
                  最多人数（含队长）
                  <input
                    name="members"
                    type="number"
                    required
                    min={2}
                    max={12}
                    defaultValue={Math.max(2, linked?.conditions.people || 4)}
                  />
                </label>
              </div>
              <div className="form-row">
                <label>
                  出发日期
                  <input
                    name="date"
                    type="date"
                    required
                    defaultValue={linked?.conditions.date || "2026-10-17"}
                    readOnly={!!linked}
                  />
                </label>
                <label>
                  旅行天数
                  <input
                    name="days"
                    type="number"
                    required
                    min={1}
                    max={7}
                    defaultValue={linked?.conditions.days || 2}
                    readOnly={!!linked}
                  />
                </label>
              </div>
              <label>全队总预算区间（非人均）</label>
              <div className="budget-inputs">
                <select
                  aria-label="币种"
                  name="currency"
                  defaultValue={linked?.conditions.currency || "AUD"}
                  disabled={!!linked}
                >
                  {["AUD", "USD", "CNY"].map((x) => (
                    <option key={x}>{x}</option>
                  ))}
                </select>
                <input
                  aria-label="最低预算"
                  name="min"
                  type="number"
                  required
                  min={0}
                  max={100000}
                  defaultValue={linked ? linked.conditions.budget : 200}
                />
                <span>—</span>
                <input
                  aria-label="最高预算"
                  name="max"
                  type="number"
                  required
                  min={1}
                  max={100000}
                  defaultValue={linked?.conditions.budget || 400}
                />
              </div>
              <label>旅行兴趣</label>
              <div className="chips">
                {interests.map((i) => (
                  <button
                    type="button"
                    key={i}
                    className={selectedInterests.includes(i) ? "chosen" : ""}
                    onClick={() =>
                      setSelectedInterests((old) =>
                        old.includes(i)
                          ? old.filter((x) => x !== i)
                          : [...old, i],
                      )
                    }
                  >
                    {i}
                  </button>
                ))}
              </div>
              <div className="form-section-label">
                02 <span>找和你同频的人</span>
              </div>
              <label>
                队伍介绍
                <textarea
                  name="description"
                  required
                  minLength={5}
                  maxLength={600}
                  rows={5}
                  placeholder="说说旅行节奏、希望遇到的搭子，以及你的计划。不要填写电话、微信、精确住址或具体集合地点。"
                />
              </label>
              <label className="consent">
                <input name="consent" type="checkbox" required />
                我确认公开内容不含个人联系方式、精确住址或未经成员同意的集合地点。
              </label>
              <button className="primary" disabled={busy}>
                {busy ? "发布中…" : "发布队伍"}
                <ArrowRight size={17} />
              </button>
            </form>
            <aside className="team-create-note">
              <span className="big-emoji">🎒</span>
              <h2>
                {linked ? "你的路线，已经带上了。" : "目的地，可以一起决定。"}
              </h2>
              <p>
                {linked
                  ? `${destinations.find((d) => d.id === linked.destinationId)?.name} · ${linked.days.length} 天路线已关联。公开页只显示目的地，完整地图仅队伍成员可见。`
                  : "先定时间和预算，找到搭子后再去地图探索。发布后由队长规划并保存共享路线。"}
              </p>
              <div className="privacy-note">
                <ShieldCheck size={20} />
                精确出发地址会被城市中心替换。组队不会公开你的定位。
              </div>
              <Link href="/teams">返回找搭子 →</Link>
            </aside>
          </div>
        ) : id ? (
          team ? (
            <div className="team-detail-layout">
              <section>
                <div className="team-detail-cover">
                  <span>
                    {team.destination ? "周末目的地已解锁" : "下一站，一起决定"}
                  </span>
                  <h2>
                    {destinations.find((d) => d.id === team.destination)
                      ?.name || "目的地待定"}
                  </h2>
                  <div>
                    {team.interests.map((i) => (
                      <b key={i}>{i}</b>
                    ))}
                  </div>
                </div>
                <article className="team-detail-card">
                  <div className="team-title-row">
                    <h2>这次怎么出发</h2>
                    <span
                      className={`recruit ${team.status === "closed" ? "closed" : ""}`}
                    >
                      {team.status === "closed"
                        ? "招募已关闭"
                        : team.count >= team.maxMembers
                          ? "已满员"
                          : "正在找搭子"}
                    </span>
                  </div>
                  <div className="detail-facts">
                    <span>
                      <MapPin size={18} />
                      {team.city} 出发
                    </span>
                    <span>
                      <CalendarDays size={18} />
                      {team.date} · {team.days} 天
                    </span>
                    <span>
                      <Users size={18} />
                      {team.count} / {team.maxMembers} 人
                    </span>
                    <span>
                      {team.currency} {team.budgetMin}–{team.budgetMax} /
                      全队预算
                    </span>
                  </div>
                  <Conditions team={team} />
                  <h3>关于这支小队</h3>
                  <p className="team-description">{team.description}</p>
                  <p className="team-host">队长 · {team.ownerName}</p>
                  <h3>行程预览</h3>
                  {team.plan ? (
                    <>
                      <div className="preview-days">
                        {team.plan.days.map((day, i) => (
                          <div key={day.id}>
                            <b>DAY {i + 1}</b>
                            <span>
                              {day.stops.map((s) => s.name).join(" → ") ||
                                "自由探索"}
                            </span>
                          </div>
                        ))}
                      </div>
                      <Link href={`/teams/${id}/plan`} className="primary">
                        {user?.id === team.ownerId
                          ? "查看与编辑行程地图"
                          : "查看共同的行程地图"}
                        <ArrowRight size={16} />
                      </Link>
                    </>
                  ) : (
                    <>
                      <p>
                        {team.destination
                          ? "加入队伍后可查看完整路线和地图。"
                          : "目的地暂未确定，加入后一起讨论，由队长规划。"}
                      </p>
                      {user?.id === team.ownerId && (
                        <Link href={`/?team=${id}`} className="primary">
                          一起规划目的地
                          <Compass size={17} />
                        </Link>
                      )}
                    </>
                  )}
                  {team.member && (
                    <>
                      <h3>一起出发的人</h3>
                      <div className="member-list">
                        {team.members?.map((m) => (
                          <span key={m.id}>
                            <i>{m.name.slice(0, 1)}</i>
                            {m.name}
                            {m.id === team.ownerId ? " · 队长" : ""}
                          </span>
                        ))}
                      </div>
                    </>
                  )}
                </article>
              </section>
              <aside className="team-side">
                <h3>
                  {team.count} 人已集结{" "}
                  <small>/ 最多 {team.maxMembers} 人</small>
                </h3>
                <div className="capacity">
                  <span
                    style={{
                      width: `${(team.count / team.maxMembers) * 100}%`,
                    }}
                  />
                </div>
                {user?.id === team.ownerId ? (
                  <>
                    <p>你是队长，可以管理申请和共享行程。</p>
                    <button
                      className="secondary full"
                      disabled={busy || team.status === "closed"}
                      onClick={() => mutate("close")}
                    >
                      关闭招募
                    </button>
                    <h3>加入申请 · {team.requests?.length || 0}</h3>
                    {team.requests?.map((r) => (
                      <div className="request-row" key={r.id}>
                        <strong>{r.name}</strong>
                        <div>
                          <button
                            disabled={
                              busy ||
                              team.count >= team.maxMembers ||
                              team.status === "closed"
                            }
                            onClick={() => mutate("accept", r.id)}
                          >
                            接受
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => mutate("reject", r.id)}
                          >
                            拒绝
                          </button>
                        </div>
                      </div>
                    ))}
                    {!team.requests?.length && <p>还没有待处理申请。</p>}
                  </>
                ) : team.member ? (
                  <>
                    <div className="member-state">你已加入这支队伍</div>
                    <button
                      disabled={busy}
                      className="secondary full"
                      onClick={() => mutate("leave")}
                    >
                      退出队伍
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      className="primary full"
                      disabled={
                        busy ||
                        team.status === "closed" ||
                        team.count >= team.maxMembers ||
                        team.requestStatus === "pending" ||
                        team.requestStatus === "rejected"
                      }
                      onClick={() => mutate("apply")}
                    >
                      {team.requestStatus === "pending"
                        ? "申请已提交，等待队长审核"
                        : team.requestStatus === "rejected"
                          ? "申请未通过"
                          : team.status === "closed"
                            ? "招募已关闭"
                            : team.count >= team.maxMembers
                              ? "队伍已满员"
                              : "申请加入"}
                    </button>
                    <p>申请通过后才会成为成员。行程由队长统一编辑。</p>
                  </>
                )}
                <div className="privacy-note">
                  <ShieldCheck size={18} />
                  请勿公开任何成员的联系方式或精确集合位置。
                </div>
                <button
                  className="report-link"
                  onClick={() => {
                    if (!user) setAuth(true);
                    else setReporting(!reporting);
                  }}
                >
                  <Flag size={14} />
                  举报此队伍
                </button>
                {reporting && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      const reason = new FormData(e.currentTarget).get(
                        "reason",
                      );
                      run(async () => {
                        await community("report", { id, reason });
                        setReporting(false);
                        setError(
                          "举报已保存。当前为人工处理队列，未承诺即时审核。",
                        );
                      });
                    }}
                  >
                    <textarea
                      name="reason"
                      aria-label="举报原因"
                      required
                      minLength={5}
                      maxLength={500}
                      placeholder="请描述问题（至少 5 个字）"
                    />
                    <button className="secondary" disabled={busy}>
                      提交举报
                    </button>
                  </form>
                )}
                <Link className="back-teams" href="/teams">
                  <ArrowLeft size={15} />
                  返回全部队伍
                </Link>
              </aside>
            </div>
          ) : (
            <div className="empty">
              {loaded ? "未找到队伍" : "正在加载队伍…"}
            </div>
          )
        ) : (
          <>
            <section className="teams-banner">
              <div>
                <span className="banner-badge">周末搭子招募中</span>
                <h2>
                  风景有人分享，
                  <br />
                  快乐就会加倍。
                </h2>
                <p>小队出发 · 同频兴趣 · 各自精彩</p>
              </div>
              <div className="banner-art" aria-hidden="true">
                <span>⛰️</span>
                <b>LET’S GO</b>
                <i>🎒</i>
                <em>✦</em>
              </div>
            </section>
            <section className="team-filters">
              <label>
                出发城市
                <select value={city} onChange={(e) => setCity(e.target.value)}>
                  <option value="">全部城市</option>
                  {Object.keys(cities).map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <label>
                出发日期
                <input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </label>
              <label>
                天数
                <select value={days} onChange={(e) => setDays(e.target.value)}>
                  <option value="">不限天数</option>
                  {[1, 2, 3, 4, 5, 6, 7].map((n) => (
                    <option value={n} key={n}>
                      {n} 天
                    </option>
                  ))}
                </select>
              </label>
              <label>
                全队预算上限
                <input
                  aria-label="预算上限"
                  type="number"
                  min="0"
                  value={price}
                  placeholder="不限"
                  onChange={(e) => setPrice(e.target.value)}
                />
              </label>
              <label>
                币种
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                >
                  {["AUD", "USD", "CNY"].map((c) => (
                    <option key={c}>{c}</option>
                  ))}
                </select>
              </label>
              <button
                className="text-button"
                onClick={() => {
                  setCity("");
                  setDate("");
                  setDays("");
                  setPrice("");
                  setInterest("");
                }}
              >
                重置
              </button>
            </section>
            <div className="teams-interest">
              <button
                className={!interest ? "active" : ""}
                onClick={() => setInterest("")}
              >
                全部推荐
              </button>
              {interests.map((i) => (
                <button
                  key={i}
                  className={interest === i ? "active" : ""}
                  onClick={() => setInterest(i)}
                >
                  {i}
                </button>
              ))}
            </div>
            <div className="team-list-heading">
              <h2>
                发现同频小队 <span>{filtered.length}</span>
              </h2>
              <p>真实用户发布 · 天气按目的地查询</p>
            </div>
            <div className="team-grid">
              {filtered.map((t) => (
                <article className="team-card" key={t.id}>
                  <Link
                    href={`/teams/${t.id}`}
                    className={`team-card-cover cover-${t.interests[0]}`}
                  >
                    <span className="recruit">
                      {t.status === "closed"
                        ? "已关闭"
                        : t.count >= t.maxMembers
                          ? "已满员"
                          : "招募中"}
                    </span>
                    <div className="cover-illustration" aria-hidden="true">
                      {t.interests.includes("自然风景")
                        ? "🏞️"
                        : t.interests.includes("美食")
                          ? "🍜"
                          : t.interests.includes("艺术文化")
                            ? "🎨"
                            : "🧳"}
                    </div>
                    <strong>
                      {destinations.find((d) => d.id === t.destination)?.name ||
                        "目的地一起定"}
                    </strong>
                    <small>{t.city} 出发</small>
                  </Link>
                  <div className="team-card-body">
                    <div className="tags">
                      {t.interests.map((i) => (
                        <span key={i}>{i}</span>
                      ))}
                    </div>
                    <h3>
                      <Link href={`/teams/${t.id}`}>{t.title}</Link>
                    </h3>
                    <p className="team-short-description">{t.description}</p>
                    <div className="team-card-meta">
                      <CalendarDays size={14} />
                      {t.date} · {t.days} 天
                      <span>
                        {t.count}/{t.maxMembers} 人
                      </span>
                    </div>
                    <Conditions team={t} />
                    <div className="team-card-bottom">
                      <strong>
                        {t.currency} {t.budgetMin}–{t.budgetMax}
                        <small>全队预算</small>
                      </strong>
                      <Link href={`/teams/${t.id}`}>查看详情 ↗</Link>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {loaded && !filtered.length && (
              <div className="teams-empty">
                <span>🎒</span>
                <h2>
                  {teams.length
                    ? "暂时没有匹配的队伍"
                    : "第一支周末小队，等你发起。"}
                </h2>
                <p>
                  {teams.length
                    ? "调整筛选条件，或发起一支符合你计划的队伍。"
                    : "这里不展示虚构的招募。发布你的计划，邀请朋友注册后申请加入。"}
                </p>
                <Link href="/teams/new" className="primary">
                  发起组队
                  <Plus size={16} />
                </Link>
              </div>
            )}
            {!loaded && <div className="empty">正在发现小队…</div>}
          </>
        )}
      </main>
    </>
  );
}
