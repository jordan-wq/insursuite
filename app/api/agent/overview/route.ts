import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const [open, urgent, unassigned, pendingPackets] = await Promise.all([
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved"),
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved").or("priority.eq.urgent,unread_by_agent.eq.true"),
    admin.from("service_requests").select("id", { count: "exact", head: true }).neq("status", "resolved").is("assigned_to", null),
    admin.from("user_policies").select("id", { count: "exact", head: true }).neq("packet_status", "delivered"),
  ]);

  return Response.json({
    openConversations: open.count || 0,
    urgentUnread: urgent.count || 0,
    unassigned: unassigned.count || 0,
    packetsPending: pendingPackets.count || 0,
  });
}
