import { AdminPlaceDetailView } from "@/components/admin/admin-place-detail";

export default async function AdminPlacePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <AdminPlaceDetailView placeId={id} />;
}
