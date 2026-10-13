import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import {
  randomUUID,
  randomBytes,
  scryptSync,
  timingSafeEqual,
  createHash,
} from "node:crypto";
import { teamSchema, cities, User, Team } from "./team-model";
import { validateCatalogPlan, Plan } from "./model";
import { destinations } from "./data";
const file =
  process.env.WEEKENDER_DB_PATH ||
  join(process.cwd(), "data", "weekender.sqlite");
let connection: DatabaseSync;
export function db() {
  if (connection) return connection;
  mkdirSync(dirname(file), { recursive: true });
  connection = new DatabaseSync(file);
  connection.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;
CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,username TEXT UNIQUE NOT NULL,name TEXT NOT NULL,password TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id),expires INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS teams(id TEXT PRIMARY KEY,owner_id TEXT NOT NULL REFERENCES users(id),title TEXT NOT NULL,city TEXT NOT NULL,date TEXT NOT NULL,days INTEGER NOT NULL,budget_min REAL NOT NULL,budget_max REAL NOT NULL,currency TEXT NOT NULL,max_members INTEGER NOT NULL CHECK(max_members BETWEEN 2 AND 12),interests TEXT NOT NULL,description TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','closed')),created_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS team_members(team_id TEXT NOT NULL REFERENCES teams(id),user_id TEXT NOT NULL REFERENCES users(id),PRIMARY KEY(team_id,user_id));
CREATE TABLE IF NOT EXISTS join_requests(id TEXT PRIMARY KEY,team_id TEXT NOT NULL REFERENCES teams(id),user_id TEXT NOT NULL REFERENCES users(id),status TEXT NOT NULL CHECK(status IN ('pending','accepted','rejected','withdrawn')),UNIQUE(team_id,user_id));
CREATE TABLE IF NOT EXISTS trip_plans(team_id TEXT PRIMARY KEY REFERENCES teams(id),owner_id TEXT NOT NULL REFERENCES users(id),payload TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS reports(id TEXT PRIMARY KEY,team_id TEXT NOT NULL REFERENCES teams(id),user_id TEXT NOT NULL REFERENCES users(id),reason TEXT NOT NULL,created_at TEXT NOT NULL,UNIQUE(team_id,user_id));
CREATE TABLE IF NOT EXISTS login_attempts(key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
`);
  return connection;
}
export class CommunityError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
export function transaction<T>(fn: () => T) {
  const d = db();
  d.exec("BEGIN IMMEDIATE");
  try {
    const result = fn();
    d.exec("COMMIT");
    return result;
  } catch (e) {
    d.exec("ROLLBACK");
    throw e;
  }
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function sessionUser(token: string | undefined): User | null {
  if (!token) return null;
  const row = db()
    .prepare(
      "SELECT u.id,u.name FROM users u JOIN sessions s ON s.user_id=u.id WHERE s.token=? AND s.expires>?",
    )
    .get(hash(token), Date.now());
  return row ? { id: String(row.id), name: String(row.name) } : null;
}
export function logout(token: string) {
  db().prepare("DELETE FROM sessions WHERE token=?").run(hash(token));
}
export function authenticate(
  username: string,
  password: string,
  name?: string,
) {
  const d = db();
  const key = hash(username.toLowerCase());
  const now = Date.now();
  const a = d
    .prepare("SELECT count,reset_at FROM login_attempts WHERE key=?")
    .get(key);
  if (a && Number(a.reset_at) > now && Number(a.count) >= 15)
    throw new CommunityError("尝试次数过多，请 15 分钟后重试", 429);
  d.prepare(
    "INSERT INTO login_attempts VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=CASE WHEN reset_at<? THEN 1 ELSE count+1 END,reset_at=CASE WHEN reset_at<? THEN excluded.reset_at ELSE reset_at END",
  ).run(key, now + 900000, now, now);
  let row = d
    .prepare("SELECT * FROM users WHERE username=?")
    .get(username.toLowerCase());
  if (name) {
    if (row) throw new CommunityError("账号已存在");
    const salt = randomBytes(16).toString("hex");
    const passwordHash = scryptSync(password, salt, 64).toString("hex");
    const id = randomUUID();
    d.prepare("INSERT INTO users VALUES(?,?,?,?)").run(
      id,
      username.toLowerCase(),
      name,
      `${salt}:${passwordHash}`,
    );
    row = { id, name, password: `${salt}:${passwordHash}` };
  } else {
    const [salt, expected] = String(
      row?.password || "0000000000000000:" + "00".repeat(64),
    ).split(":");
    const actual = scryptSync(password, salt, 64);
    if (!row || !timingSafeEqual(actual, Buffer.from(expected, "hex")))
      throw new CommunityError("账号或密码不正确", 401);
  }
  const token = randomBytes(32).toString("hex");
  d.prepare("INSERT INTO sessions VALUES(?,?,?)").run(
    hash(token),
    String(row!.id),
    now + 7 * 86400000,
  );
  d.prepare("DELETE FROM sessions WHERE expires<?").run(now);
  return { user: { id: String(row!.id), name: String(row!.name) }, token };
}
function raw(id: string) {
  const t = db().prepare("SELECT * FROM teams WHERE id=?").get(id);
  if (!t) throw new CommunityError("队伍不存在", 404);
  return t;
}
function isMember(id: string, uid: string) {
  return !!db()
    .prepare("SELECT 1 FROM team_members WHERE team_id=? AND user_id=?")
    .get(id, uid);
}
function owner(id: string, uid: string) {
  const t = raw(id);
  if (t.owner_id !== uid) throw new CommunityError("只有队长可以操作", 403);
  return t;
}
function sanitizePlan(input: unknown, city: keyof typeof cities): Plan {
  const p = validateCatalogPlan(input, destinations);
  if (!p) throw new CommunityError("行程格式或地点校验失败");
  return {
    ...p,
    conditions: { ...p.conditions, origin: city, point: cities[city] },
    days: p.days.map((day) => ({
      ...day,
      stops: day.stops.map((stop) => ({
        ...destinations
          .find((d) => d.id === p.destinationId)!
          .pois.find((s) => s.id === stop.id)!,
        minutes: stop.minutes,
      })),
    })),
  };
}
export function listTeams(user: User | null, id?: string): Team[] {
  const d = db();
  const rows = id
    ? [raw(id)]
    : d.prepare("SELECT * FROM teams ORDER BY created_at DESC LIMIT 200").all();
  return rows.map((t) => {
    const teamId = String(t.id);
    const member = !!user && isMember(teamId, user.id);
    const p = d
      .prepare("SELECT payload FROM trip_plans WHERE team_id=?")
      .get(teamId);
    const plan = p ? (JSON.parse(String(p.payload)) as Plan) : null;
    return {
      id: teamId,
      ownerId: String(t.owner_id),
      ownerName: String(
        d.prepare("SELECT name FROM users WHERE id=?").get(t.owner_id!)!.name,
      ),
      title: String(t.title),
      city: String(t.city) as keyof typeof cities,
      date: String(t.date),
      days: Number(t.days),
      budgetMin: Number(t.budget_min),
      budgetMax: Number(t.budget_max),
      currency: String(t.currency),
      maxMembers: Number(t.max_members),
      interests: JSON.parse(String(t.interests)),
      description: String(t.description),
      status: String(t.status),
      count: Number(
        d
          .prepare("SELECT COUNT(*) n FROM team_members WHERE team_id=?")
          .get(teamId)!.n,
      ),
      destination: plan?.destinationId || null,
      member,
      requestStatus: user
        ? String(
            d
              .prepare(
                "SELECT status FROM join_requests WHERE team_id=? AND user_id=?",
              )
              .get(teamId, user.id)?.status || "",
          ) || null
        : null,
      ...(id
        ? {
            plan: member ? plan : null,
            members: member
              ? (d
                  .prepare(
                    "SELECT u.id,u.name FROM users u JOIN team_members m ON m.user_id=u.id WHERE m.team_id=?",
                  )
                  .all(teamId) as User[])
              : [],
            requests:
              user?.id === t.owner_id
                ? (d
                    .prepare(
                      "SELECT r.id,r.user_id userId,r.status,u.name FROM join_requests r JOIN users u ON u.id=r.user_id WHERE r.team_id=? AND r.status='pending'",
                    )
                    .all(teamId) as unknown as Team["requests"])
                : [],
          }
        : {}),
    };
  });
}
export function createTeam(user: User, input: unknown) {
  const parsed = teamSchema.safeParse(input);
  if (!parsed.success)
    throw new CommunityError("请填写完整有效的组队信息，并确认隐私提示");
  const x = parsed.data;
  const plan = x.plan ? sanitizePlan(x.plan, x.city) : null;
  if (
    plan &&
    (plan.conditions.days !== x.days ||
      plan.conditions.date !== x.date ||
      plan.conditions.currency !== x.currency)
  )
    throw new CommunityError("日期、天数及币种必须与关联行程一致");
  const id = randomUUID();
  transaction(() => {
    db()
      .prepare("INSERT INTO teams VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?)")
      .run(
        id,
        user.id,
        x.title,
        x.city,
        x.date,
        x.days,
        x.budgetMin,
        x.budgetMax,
        x.currency,
        x.maxMembers,
        JSON.stringify(x.interests),
        x.description,
        "open",
        new Date().toISOString(),
      );
    db().prepare("INSERT INTO team_members VALUES(?,?)").run(id, user.id);
    if (plan)
      db()
        .prepare("INSERT INTO trip_plans VALUES(?,?,?,?)")
        .run(id, user.id, JSON.stringify(plan), new Date().toISOString());
  });
  return id;
}
export function mutateTeam(
  user: User,
  id: string,
  action: string,
  requestId?: string,
  payload?: unknown,
) {
  return transaction(() => {
    const t = raw(id);
    const d = db();
    const member = isMember(id, user.id);
    const count = Number(
      d.prepare("SELECT COUNT(*) n FROM team_members WHERE team_id=?").get(id)!
        .n,
    );
    if (action === "apply") {
      if (member) throw new CommunityError("你已经在队伍中");
      if (t.status !== "open" || count >= Number(t.max_members))
        throw new CommunityError("队伍已满员或关闭招募", 409);
      const old = d
        .prepare(
          "SELECT status FROM join_requests WHERE team_id=? AND user_id=?",
        )
        .get(id, user.id);
      if (old && old.status !== "withdrawn")
        throw new CommunityError("不能重复申请", 409);
      d.prepare(
        "INSERT INTO join_requests VALUES(?,?,?,'pending') ON CONFLICT(team_id,user_id) DO UPDATE SET status='pending'",
      ).run(randomUUID(), id, user.id);
    } else if (action === "accept" || action === "reject") {
      owner(id, user.id);
      const r = d
        .prepare("SELECT * FROM join_requests WHERE id=? AND team_id=?")
        .get(requestId || "", id);
      if (!r || r.status !== "pending")
        throw new CommunityError("申请已处理或不存在", 409);
      if (r.user_id === user.id)
        throw new CommunityError("不能审批自己的申请", 403);
      if (action === "accept") {
        if (t.status !== "open" || count >= Number(t.max_members))
          throw new CommunityError("队伍已满员或关闭招募", 409);
        d.prepare("INSERT INTO team_members VALUES(?,?)").run(id, r.user_id!);
      }
      d.prepare("UPDATE join_requests SET status=? WHERE id=?").run(
        action === "accept" ? "accepted" : "rejected",
        r.id!,
      );
    } else if (action === "leave") {
      if (t.owner_id === user.id)
        throw new CommunityError("队长不能退出，请关闭招募");
      if (!member) throw new CommunityError("你不是成员", 403);
      d.prepare("DELETE FROM team_members WHERE team_id=? AND user_id=?").run(
        id,
        user.id,
      );
      d.prepare(
        "UPDATE join_requests SET status='withdrawn' WHERE team_id=? AND user_id=?",
      ).run(id, user.id);
    } else if (action === "close") {
      owner(id, user.id);
      d.prepare("UPDATE teams SET status='closed' WHERE id=?").run(id);
      d.prepare(
        "UPDATE join_requests SET status='rejected' WHERE team_id=? AND status='pending'",
      ).run(id);
    } else if (action === "savePlan") {
      owner(id, user.id);
      const plan = sanitizePlan(payload, String(t.city) as keyof typeof cities);
      if (
        plan.conditions.days !== t.days ||
        plan.conditions.date !== t.date ||
        plan.conditions.currency !== t.currency
      )
        throw new CommunityError("请保持队伍的日期、天数和币种不变");
      d.prepare(
        "INSERT INTO trip_plans VALUES(?,?,?,?) ON CONFLICT(team_id) DO UPDATE SET payload=excluded.payload,updated_at=excluded.updated_at",
      ).run(id, user.id, JSON.stringify(plan), new Date().toISOString());
    } else throw new CommunityError("不支持的操作");
    return { ok: true };
  });
}
export function report(user: User, id: string, reason: string) {
  raw(id);
  db()
    .prepare(
      "INSERT INTO reports VALUES(?,?,?,?,?) ON CONFLICT(team_id,user_id) DO UPDATE SET reason=excluded.reason,created_at=excluded.created_at",
    )
    .run(randomUUID(), id, user.id, reason, new Date().toISOString());
}
