import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  authenticate,
  sessionUser,
  logout,
  listTeams,
  createTeam,
  mutateTeam,
  report,
  CommunityError,
} from "@/lib/community-db";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function POST(req: NextRequest) {
  try {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host"))
      throw new CommunityError("不允许跨站操作", 403);
    if (!req.headers.get("content-type")?.includes("application/json"))
      throw new CommunityError("需要 JSON 请求", 415);
    const text = await req.text();
    if (text.length > 100000) throw new CommunityError("请求过大", 413);
    const body = JSON.parse(text);
    const action = z.string().parse(body.action);
    const token = req.cookies.get("weekender-session")?.value;
    const user = sessionUser(token);
    let data: unknown;
    if (action === "me") data = { user };
    else if (action === "login" || action === "register") {
      const x = z
        .object({
          username: z.string().regex(/^[a-zA-Z0-9_]{3,30}$/),
          password: z.string().min(10).max(128),
          name: z.string().trim().min(2).max(24).optional(),
        })
        .parse(body);
      if (action === "register" && !x.name)
        throw new CommunityError("请填写昵称");
      const auth = authenticate(
        x.username,
        x.password,
        action === "register" ? x.name : undefined,
      );
      const response = NextResponse.json({ user: auth.user });
      response.cookies.set("weekender-session", auth.token, {
        httpOnly: true,
        sameSite: "lax",
        secure:
          (origin ? new URL(origin).protocol : new URL(req.url).protocol) ===
          "https:",
        path: "/",
        maxAge: 604800,
      });
      return response;
    } else if (action === "logout") {
      if (token) logout(token);
      const r = NextResponse.json({ ok: true });
      r.cookies.delete("weekender-session");
      return r;
    } else if (action === "list") data = { teams: listTeams(user) };
    else if (action === "detail")
      data = { team: listTeams(user, z.string().uuid().parse(body.id))[0] };
    else {
      if (!user) throw new CommunityError("请先登录", 401);
      if (action === "create") data = { id: createTeam(user, body.team) };
      else {
        const id = z.string().uuid().parse(body.id);
        if (action === "report") {
          report(
            user,
            id,
            z.string().trim().min(5).max(500).parse(body.reason),
          );
          data = { ok: true };
        } else data = mutateTeam(user, id, action, body.requestId, body.plan);
      }
    }
    return NextResponse.json(data, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    if (e instanceof CommunityError)
      return NextResponse.json({ error: e.message }, { status: e.status });
    if (e instanceof z.ZodError || e instanceof SyntaxError)
      return NextResponse.json(
        { error: "输入格式无效，请检查字段" },
        { status: 400 },
      );
    console.error(
      "Community operation failed",
      e instanceof Error ? e.message : "unknown",
    );
    return NextResponse.json(
      { error: "服务暂不可用，请稍后重试" },
      { status: 500 },
    );
  }
}
