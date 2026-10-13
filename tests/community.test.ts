import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { defaultConditions, destinations } from "../lib/data";
import { draft } from "../lib/model";
process.env.WEEKENDER_DB_PATH = join(
  mkdtempSync(join(tmpdir(), "weekender-test-")),
  "community.sqlite",
);
test("real accounts, private plans, requests and transactional capacity", async () => {
  const {
    authenticate,
    sessionUser,
    createTeam,
    listTeams,
    mutateTeam,
    report,
    logout,
    db,
  } = await import("../lib/community-db");
  const captain = authenticate("captain", "safe-password-123", "队长");
  const alice = authenticate("alice", "safe-password-123", "小花");
  const bob = authenticate("bob", "safe-password-123", "小明");
  assert.equal(sessionUser(captain.token)?.id, captain.user.id);
  assert.throws(() => authenticate("captain", "wrong-password-123"));
  const plan = {
    version: 2,
    conditions: {
      ...defaultConditions,
      origin: "Private home 123",
      point: { lat: 1.23456, lng: 2.34567 },
    },
    destinationId: "blue-mountains",
    days: draft(defaultConditions, destinations[0]),
    savedAt: new Date().toISOString(),
  };
  const id = createTeam(captain.user, {
    title: "蓝山周末一起走",
    city: "Sydney",
    date: "2026-10-17",
    days: 2,
    budgetMin: 200,
    budgetMax: 300,
    currency: "AUD",
    maxMembers: 2,
    interests: ["自然风景"],
    description: "轻松看风景，欢迎一起出发。",
    consent: true,
    plan,
  });
  const publicTeam = listTeams(null, id)[0];
  assert.equal(publicTeam.plan, null);
  assert.deepEqual(publicTeam.members, []);
  assert.equal(JSON.stringify(publicTeam).includes("Private home"), false);
  assert.equal(
    listTeams(captain.user, id)[0].plan?.conditions.origin,
    "Sydney",
  );
  mutateTeam(alice.user, id, "apply");
  assert.throws(() => mutateTeam(alice.user, id, "apply"), /重复/);
  mutateTeam(bob.user, id, "apply");
  const requests = listTeams(captain.user, id)[0].requests!;
  const a = requests.find((r) => r.userId === alice.user.id)!;
  const b = requests.find((r) => r.userId === bob.user.id)!;
  assert.throws(() => mutateTeam(alice.user, id, "accept", a.id), /队长/);
  assert.throws(
    () => mutateTeam(bob.user, id, "savePlan", undefined, plan),
    /队长/,
  );
  assert.throws(() => mutateTeam(bob.user, id, "close"), /队长/);
  mutateTeam(captain.user, id, "accept", a.id);
  assert.equal(listTeams(alice.user, id)[0].member, true);
  assert.ok(listTeams(alice.user, id)[0].plan);
  assert.throws(() => mutateTeam(captain.user, id, "accept", b.id), /满员/);
  assert.equal(listTeams(null, id)[0].count, 2);
  assert.throws(() => mutateTeam(captain.user, id, "leave"), /队长/);
  mutateTeam(alice.user, id, "leave");
  assert.equal(listTeams(alice.user, id)[0].plan, null);
  assert.equal(listTeams(null, id)[0].count, 1);
  mutateTeam(captain.user, id, "reject", b.id);
  assert.equal(listTeams(bob.user, id)[0].requestStatus, "rejected");
  mutateTeam(alice.user, id, "apply");
  mutateTeam(captain.user, id, "close");
  assert.equal(listTeams(alice.user, id)[0].requestStatus, "rejected");
  assert.throws(() => mutateTeam(alice.user, id, "apply"), /关闭/);
  report(alice.user, id, "公开介绍涉嫌不当内容，需要核查");
  assert.equal(db().prepare("SELECT count(*) n FROM reports").get()!.n, 1);
  logout(captain.token);
  assert.equal(sessionUser(captain.token), null);
  assert.equal(listTeams(null, id)[0].title, "蓝山周末一起走");
});
