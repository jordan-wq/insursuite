import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgentEditableRequestStatus } from "../../../service-request-model";
import { isAgent } from "../../../service-routing";

const REQUEST_SELECT = "id, userId:user_id, requestType:request_type, details, requestData:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const email = user.email.toLowerCase();
  const [{ data: requests }, { data: notifications }] = await Promise.all([
    admin.from("service_requests").select(REQUEST_SELECT).eq("assigned_to", email).order("created_at", { ascending: false }),
    admin.from("agent_notifications").select("id, agentEmail:agent_email, clientEmail:client_email, serviceRequestId:service_request_id, title, message, read, createdAt:created_at").eq("agent_email", email).order("created_at", { ascending: false }).limit(30),
  ]);

  const clientIds = [...new Set((requests || []).map((item) => item.userId))];
  const { data: clients } = clientIds.length
    ? await admin.from("client_profiles").select("userId:user_id, fullName:full_name").in("user_id", clientIds)
    : { data: [] as { userId: string; fullName: string }[] };

  return Response.json({
    requests: (requests || []).map((item) => ({ ...item, clientName: clients?.find((client) => client.userId === item.userId)?.fullName || item.userId })),
    notifications: notifications || [],
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.email))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: number; status?: string };
  if (!body.id || !isAgentEditableRequestStatus(body.status)) return Response.json({ error: "Valid request and status required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: saved, error } = await admin
    .from("service_requests")
    .update({ status: body.status, unread_by_agent: false, updated_at: new Date().toISOString() })
    .eq("id", body.id)
    .eq("assigned_to", user.email.toLowerCase())
    .select(REQUEST_SELECT)
    .single();

  if (error || !saved) return Response.json({ error: "Request not found in your assigned queue" }, { status: 404 });
  return Response.json({ request: saved });
}
