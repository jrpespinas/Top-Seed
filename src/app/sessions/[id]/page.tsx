import { SessionDetailView } from "@/components/sessions/SessionDetailView";

export default function SessionDetailPage({ params }: { params: { id: string } }) {
  return <SessionDetailView sessionId={params.id} />;
}
