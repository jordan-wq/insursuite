import { createServerSupabase } from "../../../../lib/supabase/server";
import { getCurrentUser } from "../../../../auth";

const MESSAGE_SELECT = "id, senderId:sender_id, senderRole:sender_role, message, createdAt:created_at";

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const supabase = await createServerSupabase();
  const { data: owned } = await supabase.from("service_requests").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: messages } = await supabase.from("service_request_messages").select(MESSAGE_SELECT).eq("service_request_id", id).order("created_at", { ascending: true });
  return Response.json({ messages: messages || [] });
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });

  const { id } = await context.params;
  const body = await request.json() as { message?: string };
  const message = (body.message || "").trim().slice(0, 4000);
  if (!message) return Response.json({ error: "Message is required" }, { status: 400 });

  const supabase = await createServerSupabase();
  const { data: owned } = await supabase.from("service_requests").select("id").eq("id", id).eq("user_id", user.id).maybeSingle();
  if (!owned) return Response.json({ error: "Request not found" }, { status: 404 });

  const { data: saved, error } = await supabase
    .from("service_request_messages")
    .insert({ service_request_id: id, sender_id: user.id, sender_role: "client", message })
    .select(MESSAGE_SELECT)
    .single();
  if (error || !saved) return Response.json({ error: "Unable to send message" }, { status: 500 });

  await supabase.from("service_requests").update({ unread_by_agent: true, updated_at: new Date().toISOString() }).eq("id", id);

  return Response.json({ message: saved }, { status: 201 });
}
