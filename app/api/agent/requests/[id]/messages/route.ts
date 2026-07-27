import { createAdminSupabase } from "../../../../../lib/supabase/admin";
import { getCurrentUser } from "../../../../../auth";
import { isAgent } from "../../../../../service-routing";

const MESSAGE_SELECT = "id, senderId:sender_id, senderRole:sender_role, message, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const admin = createAdminSupabase();
  const { data: owned } = await admin.from("service_requests").select("id").eq("id", id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: messages } = await admin.from("service_request_messages").select(MESSAGE_SELECT).eq("service_request_id", id).order("created_at", { ascending: true });
  return Response.json({ messages: messages || [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user || !(await isAgent(user.id))) return Response.json({ error: "Agent access required" }, { status: 403 });

  const { id } = await context.params;
  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const admin = createAdminSupabase();
  const { data: owned } = await admin.from("service_requests").select("id, userId:user_id").eq("id", id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: saved, error } = await admin
    .from("service_request_messages")
    .insert({ service_request_id: id, sender_id: user.id, sender_role: "agent", message })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !saved) return Response.json({ error: "Unable to send message" }, { status: 500 });

  await admin.from("service_requests").update({ unread_by_agent: false, updated_at: new Date().toISOString() }).eq("id", id);
  await admin.from("notifications").insert({
    user_id: owned.userId,
    type: "agent_reply",
    title: "You have a new reply",
    message: message.slice(0, 200),
    related_id: id,
  });

  return Response.json({ message: saved }, { status: 201 });
}
