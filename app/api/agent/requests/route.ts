import { createAdminSupabase } from "../../../lib/supabase/admin";
import { getCurrentUser } from "../../../auth";
import { isAgent } from "../../../service-routing";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const body = await request.json() as { clientId?: string; requestType?: string; message?: string };
  const requestType = body.requestType?.trim().slice(0, 120);
  const message = body.message?.trim().slice(0, 4000);
  if (!body.clientId || !requestType || !message) {
    return Response.json({ error: "Client, request type, and an opening message are required" }, { status: 400 });
  }

  const admin = createAdminSupabase();
  const { data: saved, error } = await admin
    .from("service_requests")
    .insert({
      user_id: body.clientId,
      request_type: requestType,
      details: message,
      status: "assigned",
      assigned_to: user.id,
      source: "agent",
      unread_by_agent: false,
    })
    .select("id")
    .single();
  if (error || !saved) return Response.json({ error: "Unable to create request" }, { status: 500 });

  await admin.from("service_request_messages").insert({ service_request_id: saved.id, sender_id: user.id, sender_role: "agent", message });
  await admin.from("notifications").insert({
    user_id: body.clientId,
    type: "agent_reply",
    title: "You have a new message",
    message: message.slice(0, 200),
    related_id: saved.id,
  });

  return Response.json({ request: saved }, { status: 201 });
}
