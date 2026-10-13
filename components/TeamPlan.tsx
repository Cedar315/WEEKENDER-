"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import Weekender from "./Weekender";
import { TeamNav } from "./Teams";
import { community, Team, User } from "@/lib/team-model";
export default function TeamPlan({ id }: { id: string }) {
  const [data, setData] = useState<{ team: Team; user: User } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    Promise.all([community("detail", { id }), community("me")])
      .then(([d, u]) => {
        if (!d.team.member || !d.team.plan) {
          setError("仅已加入的成员可以查看共享行程。");
          return;
        }
        setData({ team: d.team, user: u.user });
      })
      .catch((e) => setError(e.message));
  }, [id]);
  if (!data)
    return (
      <>
        <TeamNav />
        <div className="empty">
          {error || "加载共享行程…"}
          <p>
            <Link href={`/teams/${id}`}>返回队伍</Link>
          </p>
        </div>
      </>
    );
  return (
    <Weekender
      shared={{
        id,
        plan: data.team.plan!,
        readOnly: data.user.id !== data.team.ownerId,
      }}
    />
  );
}
