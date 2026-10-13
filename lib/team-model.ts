import { z } from "zod";
import type { Plan } from "./model";
export const cities = {
  Sydney: { lat: -33.8688, lng: 151.2093 },
  Melbourne: { lat: -37.8136, lng: 144.9631 },
  Brisbane: { lat: -27.4698, lng: 153.0251 },
  Beijing: { lat: 39.9042, lng: 116.4074 },
  Shanghai: { lat: 31.2304, lng: 121.4737 },
};
export const teamSchema = z
  .object({
    title: z.string().trim().min(3).max(60),
    city: z.enum(["Sydney", "Melbourne", "Brisbane", "Beijing", "Shanghai"]),
    date: z.string().date(),
    days: z.number().int().min(1).max(7),
    budgetMin: z.number().min(0).max(100000),
    budgetMax: z.number().positive().max(100000),
    currency: z.enum(["AUD", "USD", "CNY"]),
    maxMembers: z.number().int().min(2).max(12),
    interests: z
      .array(
        z.enum([
          "自然风景",
          "城市探索",
          "艺术文化",
          "美食",
          "休闲",
          "户外活动",
        ]),
      )
      .min(1)
      .max(6),
    description: z.string().trim().min(5).max(600),
    consent: z.literal(true),
    plan: z.unknown().optional(),
  })
  .refine((t) => t.budgetMax >= t.budgetMin, "预算范围无效");
export type TeamInput = z.infer<typeof teamSchema>;
export type User = { id: string; name: string };
export type Team = {
  id: string;
  ownerId: string;
  title: string;
  city: keyof typeof cities;
  date: string;
  days: number;
  budgetMin: number;
  budgetMax: number;
  currency: string;
  maxMembers: number;
  interests: string[];
  description: string;
  status: string;
  destination: string | null;
  count: number;
  ownerName: string;
  member: boolean;
  requestStatus: string | null;
  plan?: Plan | null;
  members?: User[];
  requests?: { id: string; name: string; userId: string; status: string }[];
};
export async function community(action: string, data: object = {}) {
  const r = await fetch("/api/community", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action, ...data }),
  });
  const body = await r.json();
  if (!r.ok) throw Error(body.error || "请求失败");
  return body;
}
