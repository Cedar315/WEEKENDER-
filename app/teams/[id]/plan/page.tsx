import TeamPlan from "@/components/TeamPlan";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <TeamPlan id={id} />;
}
