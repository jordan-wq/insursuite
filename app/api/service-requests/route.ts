import { createServerSupabase } from "../../lib/supabase/server";
import { createAdminSupabase } from "../../lib/supabase/admin";
import { getCurrentUser } from "../../auth";
import { initialRequestStatus, priorityForUrgency, sanitizeServiceRequestData } from "../../service-request-model";
import { chooseAgent } from "../../service-routing";

const REQUEST_SELECT = "id, requestType:request_type, details, requestDataJson:request_data, status, assignedTo:assigned_to, source, priority, unreadByAgent:unread_by_agent, createdAt:created_at, updatedAt:updated_at";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const supabase = await createServerSupabase();
  const { data: requests } = await supabase
    .from("service_requests")
    .select(REQUEST_SELECT)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  return Response.json({ requests: (requests || []).map((request) => ({ ...request, requestDataJson: JSON.stringify(request.requestDataJson || {}) })) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const body = await request.json() as { requestType?: string; details?: string; requestData?: Record<string, unknown> };
  if (!body.requestType?.trim()) return Response.json({ error: "Request type is required" }, { status: 400 });
  const requestType = body.requestType.trim().slice(0, 120);
  const details = (body.details || "").trim().slice(0, 4000);
  const requestData = sanitizeServiceRequestData(body.requestData);
  const assignedTo = await chooseAgent(user.id);
  const priority = priorityForUrgency(requestData.urgency);

  const supabase = await createServerSupabase();
  const { data: saved, error } = await supabase
    .from("service_requests")
    .insert({
      user_id: user.id,
      request_type: requestType,
      details,
      request_data: requestData,
      status: initialRequestStatus(assignedTo),
      assigned_to: assignedTo,
      source: "client",
      priority,
      unread_by_agent: true,
    })
    .select(REQUEST_SELECT)
    .single();

  if (error || !saved) return Response.json({ error: "Unable to create request" }, { status: 500 });

  if (assignedTo) {
    const admin = createAdminSupabase();
    await admin.from("agent_notifications").insert({
      agent_id: assignedTo,
      client_id: user.id,
      service_request_id: saved.id,
      title: `New ${requestType} request`,
      message: details.slice(0, 500),
    });
  }

  return Response.json({ request: { ...saved, requestDataJson: JSON.stringify(saved.requestDataJson || {}) } }, { status: 201 });
}
