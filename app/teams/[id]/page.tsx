import Teams from "@/components/Teams";
export default async function Page({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <Teams id={id} />;
}
