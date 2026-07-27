import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgentEditableRequestStatus } from "../../../service-request-model";
import { isAgent } from "../../../service-routing";

const REQUEST_SELECT = "id, userId:user_id, requestType:request_type, details, requestData:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const admin = createAdminSupabase();
  const [{ data: requests }, { data: notifications }] = await Promise.all([
    admin.from("service_requests").select(REQUEST_SELECT).order("created_at", { ascending: false }),
    admin.from("agent_notifications").select("id, agentId:agent_id, clientId:client_id, serviceRequestId:service_request_id, title, message, read, createdAt:created_at").eq("agent_id", user.id).order("created_at", { ascending: false }).limit(30),
  ]);

  const clientIds = [...new Set((requests || []).map((item) => item.userId))];
  const assignedAgentIds = [...new Set((requests || []).map((item) => item.assignedTo).filter((id): id is string => Boolean(id)))];

  const [{ data: clients }, { data: assignedAgentProfiles }] = await Promise.all([
    clientIds.length
      ? admin.from("client_profiles").select("userId:user_id, fullName:full_name").in("user_id", clientIds)
      : Promise.resolve({ data: [] as { userId: string; fullName: string }[] }),
    assignedAgentIds.length
      ? admin.from("client_profiles").select("userId:user_id, email").in("user_id", assignedAgentIds)
      : Promise.resolve({ data: [] as { userId: string; email: string }[] }),
  ]);

  return Response.json({
    requests: (requests || []).map((item) => ({
      ...item,
      clientName: clients?.find((client) => client.userId === item.userId)?.fullName || item.userId,
      assignedToEmail: item.assignedTo ? (assignedAgentProfiles?.find((p) => p.userId === item.assignedTo)?.email || "(no profile)") : null,
    })),
    notifications: notifications || [],
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { id?: string; status?: string; assignedTo?: string | null };
  if (!body.id) return Response.json({ error: "Request id required" }, { status: 400 });

  const update: Record<string, unknown> = { unread_by_agent: false, updated_at: new Date().toISOString() };
  if (body.status !== undefined) {
    if (!isAgentEditableRequestStatus(body.status)) return Response.json({ error: "Invalid status" }, { status: 400 });
    update.status = body.status;
  }
  if (body.assignedTo !== undefined) {
    update.assigned_to = body.assignedTo;
  }
  if (body.status === undefined && body.assignedTo === undefined) return Response.json({ error: "status or assignedTo required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: saved, error } = await admin
    .from("service_requests")
    .update(update)
    .eq("id", body.id)
    .select(REQUEST_SELECT)
    .single();

  if (error || !saved) return Response.json({ error: "Request not found" }, { status: 404 });
  return Response.json({ request: saved });
}
